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
import { GoogleAuth, OAuth2Client } from 'google-auth-library'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'))

import { buildServerInstructions } from './lib/knowledge/instructions.js'
import { registerTools } from './tools/index.js'
import { registerPrompts } from './prompts/index.js'
import { checkGCP } from './lib/util/gcp.js'
import { featureFlags, FLAGS } from './lib/util/feature_flags.js'
import { logger } from './lib/util/logger.js'
import { printBanner, dim } from './lib/util/banner.js'
import { buildScopesField, buildAuthRemediationLines, buildQuotaProjectWarning } from './lib/util/auth_messages.js'
import { verifyIdToken, parseExpectedAudience } from './lib/util/credential/jwt_verifier.js'
import { TAGS, SCOPES } from './lib/constants.js'

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
 * Probes Application Default Credentials and inspects the access token.
 *
 * Returns `{ valid: false }` when no usable credentials are configured.
 * When valid, hits the Google tokeninfo endpoint to read the granted
 * scopes off the access token, then diffs them against `requiredScopes`.
 * `cloud-platform` is treated as implicitly covering the
 * `service.management*` family (matches Google's IAM behavior).
 *
 * `scopesKnown` is false when tokeninfo could not be reached or rejected
 * the token (e.g. some self-signed JWT flows) — callers should not
 * report scope status as authoritative in that case.
 * @param {string[]} requiredScopes - The OAuth scopes the server needs.
 * @returns {Promise<{valid: boolean, email: ?string, missingScopes: string[], scopesKnown: boolean}>} Probe result.
 */
async function probeADC(requiredScopes) {
  const empty = {
    valid: false,
    email: null,
    missingScopes: [],
    scopesKnown: false,
    credentialType: null,
    quotaProject: null,
  }
  // Test mode (fake API server) bypasses real ADC; skipping the probe
  // keeps test startup fast and avoids hitting Google in CI.
  if (process.env.GOOGLE_API_ROOT_URL) {
    return empty
  }
  // The probe touches the network twice (token endpoint, then tokeninfo).
  // Cap it so a slow or offline environment can't hold the banner
  // indefinitely; the server itself works regardless of whether the
  // probe completes.
  const PROBE_TIMEOUT_MS = 8000
  const work = (async () => {
    try {
      const auth = new GoogleAuth()
      const client = await auth.getClient()
      const { token } = await client.getAccessToken()
      if (!token) {
        return empty
      }
      let email = client.email || null
      let granted = []
      try {
        const info = await new OAuth2Client().getTokenInfo(token)
        email = email || info.email || null
        granted = info.scopes || []
      } catch {
        // tokeninfo rejects opaque or self-signed JWT tokens; surface as unknown.
      }
      const grantedSet = new Set(granted)
      const cloudPlatform = grantedSet.has('https://www.googleapis.com/auth/cloud-platform')
      const missingScopes = requiredScopes.filter(s => {
        if (grantedSet.has(s)) {
          return false
        }
        if (cloudPlatform && s.startsWith('https://www.googleapis.com/auth/service.management')) {
          return false
        }
        return true
      })
      return {
        valid: true,
        email,
        missingScopes,
        scopesKnown: granted.length > 0,
        credentialType: client.constructor?.name || null,
        quotaProject: process.env.GOOGLE_CLOUD_QUOTA_PROJECT || client.quotaProjectId || null,
      }
    } catch {
      return empty
    }
  })()
  let timer
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(empty), PROBE_TIMEOUT_MS)
  })
  const result = await Promise.race([work, timeout])
  clearTimeout(timer)
  return result
}

/**
 * Builds a fresh per-request session-state object. Each HTTP request must call
 * this so that resolved customerId / orgUnit data from one Workspace tenant
 * cannot bleed into a concurrent request from another.
 * @returns {{customerId: null, cachedRootOrgUnitId: null, pendingRule: null, history: Array}} A new session-state object with all fields zeroed.
 */
export function createSessionState() {
  return { customerId: null, cachedRootOrgUnitId: null, pendingRule: null, history: [] }
}

/**
 * Builds the Express handler for POST /mcp. Each invocation constructs a fresh
 * per-request sessionState via createSessionState() and passes it to getServer,
 * so concurrent requests cannot share customerId/orgUnit cache.
 * @param {object} gcpInfo - GCP environment metadata.
 * @param {(gcpInfo: object, sessionState: object) => Promise<object>} [getServerImpl] - Override for tests.
 * @returns {(req: import('express').Request, res: import('express').Response) => Promise<void>} The Express request handler.
 */
export function createMcpPostHandler(gcpInfo, getServerImpl = getServer) {
  return async (req, res) => {
    const sessionState = createSessionState()
    const server = await getServerImpl(gcpInfo, sessionState)
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
  }
}

/**
 * Builds the Express handler for GET /sse. Each new SSE connection constructs
 * a fresh per-session sessionState; subsequent /messages POSTs route through
 * the registered transport, which holds a reference to that same server.
 * @param {object} gcpInfo - GCP environment metadata.
 * @param {Record<string, SSEServerTransport>} sseTransports - Map of sessionId -> transport.
 * @param {(gcpInfo: object, sessionState: object) => Promise<object>} [getServerImpl] - Override for tests.
 * @returns {(req: import('express').Request, res: import('express').Response) => Promise<void>} The Express request handler.
 */
export function createSseHandler(gcpInfo, sseTransports, getServerImpl = getServer) {
  return async (_req, res) => {
    logger.info(`${TAGS.MCP} /sse Received request`)
    try {
      const sessionState = createSessionState()
      const server = await getServerImpl(gcpInfo, sessionState)
      const transport = new SSEServerTransport('/messages', res)
      sseTransports[transport.sessionId] = transport
      res.on('close', () => {
        delete sseTransports[transport.sessionId]
        try {
          transport.close()
        } catch (e) {
          logger.error(`${TAGS.MCP} Error closing SSE transport:`, e)
        }
        try {
          server.close()
        } catch (e) {
          logger.error(`${TAGS.MCP} Error closing SSE server:`, e)
        }
      })
      await server.connect(transport)
    } catch (error) {
      logger.error(`${TAGS.MCP} Error handling SSE request:`, error)
      if (!res.headersSent) {
        res.status(500).send(error.message || 'Internal server error')
      }
    }
  }
}

/**
 * Initializes and configures the MCP server instance.
 * @param {object} gcpInfo - The detected GCP environment metadata
 * @param {object} sharedSessionState - The shared session state for cross-request persistence
 * @returns {Promise<McpServer>} The configured MCP server instance
 */
export async function getServer(gcpInfo, sharedSessionState) {
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
 * @returns {Promise<void>} Resolves when the server is shut down.
 */
export async function runServer() {
  try {
    const gcpInfo = await checkGCP()
    const isStdio = shouldStartStdio(gcpInfo)

    if (isStdio) {
      makeLoggingCompatibleWithStdio()
    }

    // Log feature flag overrides
    Object.values(FLAGS).forEach(flag => {
      if (!featureFlags.isDefault(flag)) {
        const status = featureFlags.isEnabled(flag) ? 'ENABLED' : 'DISABLED'
        logger.info(`${TAGS.MCP} EXPERIMENT_${flag} override: ${status}`)
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

    const flagOverrides =
      Object.values(FLAGS)
        .filter(flag => !featureFlags.isDefault(flag))
        .map(flag => `${flag}=${featureFlags.isEnabled(flag)}`)
        .join(', ') || 'None'

    const requiredScopes = Object.values(SCOPES)
    const adc = await probeADC(requiredScopes)

    const printServerStatus = assignedPort => {
      printBanner({
        transport: isStdio ? 'Stdio' : ['SSE/HTTP', `(Port: ${assignedPort})`],
        auth: isStdio ? ['None', '(Local channel)'] : ['None', '(Unauthenticated)'],
        apiCreds: adc.valid ? ['ADC', adc.email ? `(${adc.email})` : '(detected)'] : ['ADC', '(not configured)'],
        scopes: buildScopesField(adc, requiredScopes),
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
      console.log(dim(`Experiment Overrides: ${flagOverrides}`))
    }

    if (isStdio) {
      printServerStatus()
      // Stdio is single-process and single-tenant, so a process-lifetime
      // sessionState is correct. HTTP mode does not reach this branch and
      // does not see this object — its handlers create per-request state
      // via createSessionState() in createMcpPostHandler / createSseHandler.
      const stdioSessionState = createSessionState()
      const stdioTransport = new StdioServerTransport()
      const server = await getServer(gcpInfo, stdioSessionState)
      await server.connect(stdioTransport)
      logger.info(`${TAGS.MCP} Chrome Enterprise Premium MCP server stdio transport connected`)
    } else {
      logger.info(`${TAGS.MCP} Stdio transport mode is turned off.`)
      const app = express()
      app.use(express.json())

      const expectedAudience = parseExpectedAudience(process.env.CEP_BEARER_AUDIENCE)
      if (expectedAudience) {
        // Trust-boundary middleware: every /mcp, /sse, /messages request must
        // carry a Google-signed ID token whose `aud` matches the expected
        // audience. Forged or missing bearers get 401 ahead of any handler.
        const audienceList = Array.isArray(expectedAudience) ? expectedAudience : [expectedAudience]
        logger.info(`${TAGS.MCP} Bearer ID-token verification is on; audience: ${audienceList.join(', ')}`)
        // Rate limiting is intentionally delegated to the deployment platform
        // (Cloud Run, Vertex AI Agent Engine, or a fronting reverse proxy).
        // Application-level limiting here would duplicate platform policy with
        // weaker client-IP attribution behind GCLB, and verifyIdToken caches
        // JWKS so the per-bad-bearer cost is local crypto, not a network round
        // trip. CodeQL: js/missing-rate-limiting (intentionally suppressed).
        app.use(async (req, res, next) => {
          const auth = req.headers.authorization
          if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
            res.status(401).json({ error: 'Bearer token required' })
            return
          }
          const token = auth.slice(7).trim()
          try {
            const principal = await verifyIdToken(token, { expectedAudience })
            // eslint-disable-next-line require-atomic-updates
            req.verifiedPrincipal = principal
            next()
          } catch (err) {
            logger.warn(`${TAGS.MCP} ID-token verification failed: ${err.message}`)
            res.status(401).json({ error: 'Bearer token verification failed' })
          }
        })
      } else {
        logger.warn(
          `${TAGS.MCP} CEP_BEARER_AUDIENCE is not set.\n` +
            `Inbound bearer tokens are forwarded to Google without local verification; bad tokens are rejected by Google rather than at this server's boundary.\n` +
            `Set CEP_BEARER_AUDIENCE to the expected OAuth client ID to verify tokens locally and attribute requests to a verified principal.\n` +
            `Setup: https://github.com/google/chrome-enterprise-premium-mcp/blob/main/docs/configuration.md#inbound-bearer-id-token-verification-http-mode`,
        )
      }

      app.post('/mcp', createMcpPostHandler(gcpInfo))

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

      app.get('/sse', createSseHandler(gcpInfo, sseTransports))

      app.post('/messages', async (req, res) => {
        logger.info(`${TAGS.MCP} /messages Received request`)
        const sessionId = req.query.sessionId
        const transport = sseTransports[sessionId]
        if (transport) {
          await transport.handlePostMessage(req, res, req.body)
        } else {
          // Log the unknown sessionId server-side so an operator can correlate
          // the failure with their /sse stream. We deliberately do not echo it
          // back: that would reflect a user-controlled query string into the
          // response body and trip the reflected-XSS detector regardless of
          // the response content type.
          logger.warn(`${TAGS.MCP} /messages: no transport found for sessionId: ${String(sessionId)}`)
          res.status(400).send('No transport found for the provided sessionId')
        }
      })

      const PORT = process.env.PORT || 0
      const httpServer = app.listen(PORT, () => {
        const address = httpServer.address()
        if (address) {
          const assignedPort = address.port
          printServerStatus(assignedPort)
          // Use console.log directly so smoke tests waiting for this line
          // are not silenced by CEP_LOG_LEVEL=SILENT.
          console.log(`${TAGS.MCP} Chrome Enterprise Premium MCP server listening on port ${assignedPort}`)
        }
      })
      httpServer.on('error', e => {
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

// Only auto-start when invoked directly; tests and bin/cli.js import this
// module without triggering the server.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runServer()
}
