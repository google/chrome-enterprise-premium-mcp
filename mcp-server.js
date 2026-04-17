#!/usr/bin/env node
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
 * Configures and starts the Model Context Protocol (MCP) server.
 * Supports both stdio (local) and SSE (remote/HTTP) transport modes.
 * Automatically detects the execution environment (local vs. GCP).
 */

import { config } from '@dotenvx/dotenvx'
config({ quiet: true, ignore: ['MISSING_ENV_FILE'] })
import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { buildServerInstructions } from './lib/knowledge/instructions.js'
import { registerTools } from './tools/index.js'
import { registerPrompts } from './prompts/index.js'
import { checkGCP } from './lib/util/gcp.js'
import { oauthMiddleware } from './lib/util/auth.js'
import { featureFlags, FLAGS } from './lib/util/feature_flags.js'
import { logger } from './lib/util/logger.js'
import { TAGS, SCOPES, BEARER_METHODS_SUPPORTED, RESPONSE_TYPES_SUPPORTED, OAUTH_ISSUER } from './lib/constants.js'

// Import Real Clients
import { RealAdminSdkClient } from './lib/api/real_admin_sdk_client.js'
import { RealCloudIdentityClient } from './lib/api/real_cloud_identity_client.js'
import { RealChromePolicyClient } from './lib/api/real_chrome_policy_client.js'
import { RealChromeManagementClient } from './lib/api/real_chrome_management_client.js'
import { RealServiceUsageClient } from './lib/api/real_service_usage_client.js'

// Import Fake Clients
import { FakeAdminSdkClient } from './lib/api/fake_admin_sdk_client.js'
import { FakeCloudIdentityClient } from './lib/api/fake_cloud_identity_client.js'
import { FakeChromePolicyClient } from './lib/api/fake_chrome_policy_client.js'
import { FakeChromeManagementClient } from './lib/api/fake_chrome_management_client.js'
import { FakeServiceUsageClient } from './lib/api/fake_service_usage_client.js'

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
      version: '1.0.0',
    },
    {
      capabilities: { logging: {}, prompts: {} },
      instructions: buildServerInstructions(),
    },
  )

  // No-op handler for setting log level (required for mcp-inspector)
  server.server.setRequestHandler(SetLevelRequestSchema, request => {
    console.debug(`${TAGS.MCP} Log Level set to: ${request.params.level}`)
    return {}
  })

  const apiOptions = {}
  let apiClients = {}

  if (process.env.GOOGLE_API_ROOT_URL) {
    apiOptions.rootUrl = process.env.GOOGLE_API_ROOT_URL
    console.error(`${TAGS.MCP}  TEST MODE: Using FAKE API clients routing to ${apiOptions.rootUrl}`)
    apiClients = {
      adminSdk: new FakeAdminSdkClient(apiOptions.rootUrl),
      cloudIdentity: new FakeCloudIdentityClient(apiOptions.rootUrl),
      chromePolicy: new FakeChromePolicyClient(apiOptions.rootUrl),
      chromeManagement: new FakeChromeManagementClient(apiOptions.rootUrl),
      serviceUsage: new FakeServiceUsageClient(apiOptions.rootUrl),
    }
  } else {
    console.error(`${TAGS.MCP} Using REAL API clients.`)
    apiClients = {
      adminSdk: new RealAdminSdkClient(apiOptions),
      cloudIdentity: new RealCloudIdentityClient(apiOptions),
      chromePolicy: new RealChromePolicyClient(apiOptions),
      chromeManagement: new RealChromeManagementClient(apiOptions),
      serviceUsage: new RealServiceUsageClient(apiOptions),
    }
  }

  const toolOptions = {
    apiClients,
    apiOptions,
    dbPath: process.env.KNOWLEDGE_DB_PATH,
    featureFlags,
  }

  if (shouldStartStdio(gcpInfo)) {
    console.error(`${TAGS.MCP} Using tools optimized for local or stdio mode.`)
    registerTools(server, toolOptions, sharedSessionState)
    registerPrompts(server)
  } else {
    console.error(`${TAGS.MCP} Running on GCP environment. Using tools optimized for remote use.`)
    registerTools(server, toolOptions, sharedSessionState)
    registerPrompts(server)
  }

  return server
}

/**
 * Starts the MCP server.
 */
async function main() {
  try {
    const gcpInfo = await checkGCP()
    const isStdio = shouldStartStdio(gcpInfo)

    // Log all enabled feature flags
    Object.values(FLAGS).forEach(flag => {
      if (featureFlags.isEnabled(flag)) {
        logger.info(`${TAGS.MCP} EXPERIMENT_${flag} is active.`)
      }
    })

    // Maintain session state globally for all server connections
    const sharedSessionState = {
      customerId: null,
      cachedRootOrgUnitId: null,
      pendingRule: null,
      history: [],
    }

    if (isStdio) {
      makeLoggingCompatibleWithStdio()
      const stdioTransport = new StdioServerTransport()
      const server = await getServer(gcpInfo, sharedSessionState)
      await server.connect(stdioTransport)
      console.error(`${TAGS.MCP} Chrome Enterprise Premium MCP server stdio transport connected`)
    } else {
      console.log(`${TAGS.MCP} Stdio transport mode is turned off.`)
      const app = express()
      app.use(express.json())

      app.post('/mcp', oauthMiddleware, async (req, res) => {
        const server = await getServer(gcpInfo, sharedSessionState)
        try {
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
          await server.connect(transport)
          await transport.handleRequest(req, res, req.body)
          res.on('close', () => {
            console.log(`${TAGS.MCP} Request closed`)
            transport.close()
            server.close()
          })
        } catch (error) {
          console.error(`${TAGS.MCP} ✗ Error handling MCP request:`, error)
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

      app.get('/mcp', async (req, res) => {
        console.log(`${TAGS.MCP} Received GET MCP request`)
        res.writeHead(405).end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed.' },
            id: null,
          }),
        )
      })

      const sseTransports = {}

      const getOAuthProtectedResource = (req, res) => {
        res.json({
          resource: process.env.OAUTH_PROTECTED_RESOURCE,
          authorization_servers: [process.env.OAUTH_AUTHORIZATION_SERVER],
          scopes_supported: Object.values(SCOPES),
          bearer_methods_supported: [...BEARER_METHODS_SUPPORTED],
        })
      }

      const getOAuthAuthorizationServer = (req, res) => {
        res.json({
          issuer: OAUTH_ISSUER,
          authorization_endpoint: process.env.OAUTH_AUTHORIZATION_ENDPOINT,
          token_endpoint: process.env.OAUTH_TOKEN_ENDPOINT,
          scopes_supported: Object.values(SCOPES),
          response_types_supported: [...RESPONSE_TYPES_SUPPORTED],
        })
      }

      app.get('/.well-known/oauth-protected-resource', getOAuthProtectedResource)
      app.get('/.well-known/oauth-authorization-server', getOAuthAuthorizationServer)

      app.get('/sse', async (req, res) => {
        console.log(`${TAGS.MCP} /sse Received request`)
        const server = await getServer(gcpInfo, sharedSessionState)
        const transport = new SSEServerTransport('/messages', res)
        sseTransports[transport.sessionId] = transport
        res.on('close', () => {
          delete sseTransports[transport.sessionId]
        })
        await server.connect(transport)
      })

      app.post('/messages', async (req, res) => {
        console.log(`${TAGS.MCP} /messages Received request`)
        const sessionId = req.query.sessionId
        const transport = sseTransports[sessionId]
        if (transport) {
          await transport.handlePostMessage(req, res, req.body)
        } else {
          res.status(400).send('No transport found for sessionId')
        }
      })

      const PORT = process.env.PORT || 3000
      app.listen(PORT, () => {
        console.log(`${TAGS.MCP} Chrome Enterprise Premium MCP server listening on port ${PORT}`)
      })
    }
  } catch (error) {
    console.error(`${TAGS.MCP} ✗ Fatal error starting server:`, error)
    process.exitCode = 1
  }
}

process.on('SIGINT', async () => {
  console.error(`${TAGS.MCP} Shutting down server...`)
  // eslint-disable-next-line n/no-process-exit
  process.exit(0)
})

main()
