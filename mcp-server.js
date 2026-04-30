/*
Copyright 2026 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * @file Chrome Enterprise Premium MCP Server Entry Point.
 *
 * Configures and starts the Model Context Protocol (MCP) server. Supports
 * stdio (local) and HTTP/SSE (remote) transports. Authenticates to Google
 * APIs via Application Default Credentials (ADC) regardless of transport.
 */

import { config } from '@dotenvx/dotenvx'
config({ quiet: true, ignore: ['MISSING_ENV_FILE'] })
import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'))

import { buildServerInstructions } from './lib/knowledge/instructions.js'
import { registerTools } from './tools/index.js'
import { registerPrompts } from './prompts/index.js'
import { checkGCP } from './lib/util/gcp.js'
import { featureFlags, FLAGS } from './lib/util/feature_flags.js'
import { logger } from './lib/util/logger.js'
import { printBanner, dim } from './lib/util/banner.js'
import { buildScopesField, buildAuthRemediationLines, buildQuotaProjectWarning } from './lib/util/auth_messages.js'
import { TAGS, SCOPES } from './lib/constants.js'
import { adcCredential } from './lib/util/credential/adc.js'
import { oauthFlowCredential } from './lib/util/credential/oauth_flow.js'

// Import Real Clients
import { RealAdminSdkClient } from './lib/api/real_admin_sdk_client.js'
import { RealCloudIdentityClient } from './lib/api/real_cloud_identity_client.js'
import { RealChromePolicyClient } from './lib/api/real_chrome_policy_client.js'
import { RealChromeManagementClient } from './lib/api/real_chrome_management_client.js'
import { RealServiceUsageClient } from './lib/api/real_service_usage_client.js'

/**
 * Redirects console.log to console.error for compatibility with Stdio transport.
 * Stdio transport uses stdout for protocol messages, so logging must go to stderr.
 */
function makeLoggingCompatibleWithStdio() {
  console.log = console.error
  logger.enableStdioMode()
}

/**
 * Determines whether to start the server in Stdio mode.
 * @param {object} gcpInfo - The detected GCP environment metadata
 * @returns {boolean} True if Stdio mode should be used, false otherwise
 */
function shouldStartStdio(gcpInfo) {
  if (process.env.GCP_STDIO === 'false' || (gcpInfo && gcpInfo.project)) {
    return false
  }
  return true
}

/**
 * Initializes and configures the MCP server instance.
 * @param {object} gcpInfo - The detected GCP environment metadata
 * @param {object} sharedSessionState - The shared session state for cross-request persistence
 * @returns {Promise<McpServer>} The configured MCP server instance
 */
async function getServer(gcpInfo, sharedSessionState) {
  const server = new McpServer(
    {
      name: 'chrome-enterprise-premium',
      version: pkg.version,
    },
    {
      capabilities: {
        logging: {},
        prompts: {},
        resources: { listChanged: false },
      },
      instructions: buildServerInstructions(),
    },
  )

  // No-op handler for setting log level (required for mcp-inspector)
  server.server.setRequestHandler(SetLevelRequestSchema, request => {
    logger.debug(`${TAGS.MCP} Log Level set to: ${request.params.level}`)
    return {}
  })

  const apiOptions = {}

  if (process.env.GOOGLE_API_ROOT_URL) {
    apiOptions.rootUrl = process.env.GOOGLE_API_ROOT_URL
    logger.info(`${TAGS.MCP} TEST MODE: Real API clients redirected to ${apiOptions.rootUrl}`)
  } else {
    logger.info(`${TAGS.MCP} Using REAL API clients.`)
  }

  const apiClients = {
    adminSdk: new RealAdminSdkClient(apiOptions),
    cloudIdentity: new RealCloudIdentityClient(apiOptions),
    chromePolicy: new RealChromePolicyClient(apiOptions),
    chromeManagement: new RealChromeManagementClient(apiOptions),
    serviceUsage: new RealServiceUsageClient(apiOptions),
  }

  const toolOptions = {
    apiClients,
    apiOptions,
    dbPath: process.env.KNOWLEDGE_DB_PATH,
    featureFlags,
  }

  registerTools(server, toolOptions, sharedSessionState)
  registerPrompts(server)
  if (shouldStartStdio(gcpInfo)) {
    logger.info(`${TAGS.MCP} Stdio mode.`)
  } else {
    logger.info(`${TAGS.MCP} Running on GCP environment.`)
  }

  return server
}

/**
 * Starts the MCP server.
 */
export async function runServer() {
  try {
    const gcpInfo = await checkGCP()
    const isStdio = shouldStartStdio(gcpInfo)

    if (isStdio) {
      makeLoggingCompatibleWithStdio()
    }

    // Log all enabled feature flags
    Object.values(FLAGS).forEach(flag => {
      if (featureFlags.isEnabled(flag)) {
        logger.info(`${TAGS.MCP} EXPERIMENT_${flag} is active.`)
      }
    })

    // Calculate Knowledge DB articles. Resolve the default path relative to
    // this module so `npx` invocations from arbitrary CWDs still find the
    // bundled corpus.
    const knowledgeDir = process.env.KNOWLEDGE_DB_PATH || fileURLToPath(new URL('./lib/knowledge', import.meta.url))
    let articleCount = 0
    try {
      const files = await fs.readdir(knowledgeDir)
      articleCount = files.filter(f => /^\d+.*\.md$/.test(f)).length
    } catch (_e) {
      // Ignore or log
    }

    const activeExps =
      Object.values(FLAGS)
        .filter(flag => featureFlags.isEnabled(flag))
        .join(', ') || 'None'

    const requiredScopes = Object.values(SCOPES)
    const probe = await adcCredential().probe()

    // Map CredentialProbe to the shape that the banner utility functions expect.
    const adc = {
      valid: probe.ok,
      email: probe.principal,
      missingScopes: probe.missingScopes,
      scopesKnown: probe.scopesKnown,
      credentialType: probe.credentialType,
      quotaProject: process.env.GOOGLE_CLOUD_QUOTA_PROJECT || null,
    }

    // OAuth-flow probe runs concurrently. A missing cache file returns
    // immediately; the boot does not block on network calls.
    let oauthProbe = null
    try {
      oauthProbe = await Promise.race([
        oauthFlowCredential().probe(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OAuth probe timed out')), 2000)
        }),
      ])
    } catch (err) {
      logger.warn(`${TAGS.MCP} OAuth-flow probe skipped: ${err.message}`)
    }

    printBanner({
      transport: isStdio ? 'Stdio' : ['SSE/HTTP', `(Port: ${process.env.PORT || '0'})`],
      auth: isStdio ? ['None', '(Local channel)'] : ['None', '(Unauthenticated)'],
      apiCreds: adc.valid ? ['ADC', adc.email ? `(${adc.email})` : '(detected)'] : ['ADC', '(not configured)'],
      scopes: buildScopesField(adc, requiredScopes),
      oauthFlowScopes: oauthProbe ? buildScopesField(oauthProbe, requiredScopes) : '⚪ OAuth flow: probe unavailable',
      dataAccess: process.env.GOOGLE_API_ROOT_URL ? 'Fake' : 'Production',
      knowledge: ['lib/knowledge', `(${articleCount} articles)`],
    })
    const remediation = buildAuthRemediationLines(adc, requiredScopes)
    if (remediation) {
      console.log()
      for (const line of remediation) {
        console.log(dim(line))
      }
      console.log()
    }
    const quotaWarning = buildQuotaProjectWarning(adc)
    if (quotaWarning) {
      console.log()
      for (const line of quotaWarning) {
        console.log(dim(line))
      }
      console.log()
    }
    console.log(dim(`Active Experiments: ${activeExps}`))

    // Maintain session state globally for all server connections
    const sharedSessionState = {
      customerId: null,
      cachedRootOrgUnitId: null,
      pendingRule: null,
      history: [],
    }

    if (isStdio) {
      const stdioTransport = new StdioServerTransport()
      const server = await getServer(gcpInfo, sharedSessionState)
      await server.connect(stdioTransport)
      logger.info(`${TAGS.MCP} Chrome Enterprise Premium MCP server stdio transport connected`)
    } else {
      logger.info(`${TAGS.MCP} Stdio transport mode is turned off.`)
      const app = express()
      app.use(express.json())

      app.post('/mcp', async (req, res) => {
        const server = await getServer(gcpInfo, sharedSessionState)
        try {
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
          await server.connect(transport)
          await transport.handleRequest(req, res, req.body)
          res.on('close', () => {
            logger.info(`${TAGS.MCP} Request closed`)
            transport.close()
            server.close()
          })
        } catch (error) {
          logger.error(`${TAGS.MCP} Error handling MCP request:`, error)
          if (!res.headersSent) {
            const status = error.status || 500
            res.status(status).json({
              jsonrpc: '2.0',
              error: {
                code: status === 401 ? -32001 : -32603,
                message: error.message || 'Internal server error',
              },
              id: null,
            })
          }
        }
      })

      app.get('/mcp', async (_req, res) => {
        logger.info(`${TAGS.MCP} Received GET MCP request`)
        res.writeHead(405).end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed.' },
            id: null,
          }),
        )
      })

      const sseTransports = {}

      app.get('/sse', async (_req, res) => {
        logger.info(`${TAGS.MCP} /sse Received request`)
        try {
          const server = await getServer(gcpInfo, sharedSessionState)
          const transport = new SSEServerTransport('/messages', res)
          sseTransports[transport.sessionId] = transport
          res.on('close', () => {
            delete sseTransports[transport.sessionId]
          })
          await server.connect(transport)
        } catch (error) {
          logger.error(`${TAGS.MCP} Error handling SSE request:`, error)
          if (!res.headersSent) {
            res.status(500).send(error.message || 'Internal server error')
          }
        }
      })

      app.post('/messages', async (req, res) => {
        logger.info(`${TAGS.MCP} /messages Received request`)
        const sessionId = req.query.sessionId
        const transport = sseTransports[sessionId]
        if (transport) {
          await transport.handlePostMessage(req, res, req.body)
        } else {
          res.status(400).send('No transport found for sessionId')
        }
      })

      const PORT = process.env.PORT || 0
      const server = app.listen(PORT, () => {
        const address = server.address()
        if (address) {
          const assignedPort = address.port
          // Use console.log directly so smoke tests waiting for this line
          // are not silenced by CEP_LOG_LEVEL=SILENT.
          console.log(`${TAGS.MCP} Chrome Enterprise Premium MCP server listening on port ${assignedPort}`)
        }
      })
      server.on('error', e => {
        if (e.code === 'EADDRINUSE') {
          logger.error(`${TAGS.MCP} Fatal error: Port ${PORT} is already in use.`)
          // eslint-disable-next-line n/no-process-exit
          process.exit(1)
        }
      })
    }
  } catch (error) {
    logger.error(`${TAGS.MCP} Fatal error starting server:`, error)
    // eslint-disable-next-line require-atomic-updates
    process.exitCode = 1
  }
}

const shutdown = async () => {
  logger.error(`${TAGS.MCP} Shutting down server...`)
  // eslint-disable-next-line n/no-process-exit
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Run only when invoked directly. pathToFileURL handles Windows drive letters
// and percent-encoding correctly; the prior `file://${argv[1]}` form was
// broken on Windows.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runServer()
}
