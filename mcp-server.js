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
 * APIs via the OAuth-flow token cache, a service-account key, or an
 * inbound Bearer token, depending on the deployment.
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
import { buildApiCredsField, buildScopesField, buildAuthRemediationLines } from './lib/util/auth_messages.js'
import { verifyIdToken, parseExpectedAudience } from './lib/util/credential/jwt_verifier.js'
import { resolveOAuthClientConfig } from './lib/util/credential/oauth_client_config.js'
import { oauthFlowCredential } from './lib/util/credential/oauth_flow.js'
import { verifyBearerToken } from './lib/util/credential/bearer_verifier.js'
import { installPrettyValidationErrors } from './lib/util/mcp_pretty_errors.js'
import { TAGS, SCOPES } from './lib/constants.js'

// Import Clients
import { AdminSdkClient } from './lib/api/admin_sdk_client.js'
import { CloudIdentityClient } from './lib/api/cloud_identity_client.js'
import { ChromePolicyClient } from './lib/api/chrome_policy_client.js'
import { ChromeManagementClient } from './lib/api/chrome_management_client.js'
import { ServiceUsageClient } from './lib/api/service_usage_client.js'

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
 * Probes the local OAuth-flow token cache and diffs its granted scopes
 * against `requiredScopes`. Capped at PROBE_TIMEOUT_MS so a slow homedir
 * filesystem (e.g., ecryptfs, NFS) cannot hang startup.
 * @param {string[]} requiredScopes - Scopes the server needs.
 * @returns {Promise<import('./lib/util/credential/index.js').CredentialProbe>} The probe result, or a synthetic not-ok result on timeout.
 */
async function probeOAuthFlow(requiredScopes) {
  const PROBE_TIMEOUT_MS = 2000
  const timeout = new Promise(resolve => {
    setTimeout(() => {
      resolve({
        ok: false,
        source: 'oauth-flow',
        principal: null,
        credentialType: null,
        scopesKnown: false,
        missingScopes: requiredScopes,
        expiry: null,
      })
    }, PROBE_TIMEOUT_MS)
  })
  return Promise.race([oauthFlowCredential({ requiredScopes }).probe(), timeout])
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
 * per-request sessionState via createSessionState() and passes it to getServer
 * along with the verified principal from req.verifiedPrincipal, so concurrent
 * requests cannot share customerId/orgUnit cache or principal context.
 * @param {object} gcpInfo - GCP environment metadata.
 * @param {(gcpInfo: object, sessionState: object, principal: ?object) => Promise<object>} [getServerImpl] - Override for tests.
 * @returns {(req: import('express').Request, res: import('express').Response) => Promise<void>} The Express request handler.
 */
export function createMcpPostHandler(gcpInfo, getServerImpl = getServer) {
  return async (req, res) => {
    const sessionState = createSessionState()
    const server = await getServerImpl(gcpInfo, sessionState, req.verifiedPrincipal || null)
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
 * the registered transport, which holds a reference to that same server. The
 * verified principal from req.verifiedPrincipal is plumbed into getServer.
 * @param {object} gcpInfo - GCP environment metadata.
 * @param {Record<string, SSEServerTransport>} sseTransports - Map of sessionId -> transport.
 * @param {(gcpInfo: object, sessionState: object, principal: ?object) => Promise<object>} [getServerImpl] - Override for tests.
 * @returns {(req: import('express').Request, res: import('express').Response) => Promise<void>} The Express request handler.
 */
export function createSseHandler(gcpInfo, sseTransports, getServerImpl = getServer) {
  return async (req, res) => {
    logger.info(`${TAGS.MCP} /sse Received request`)
    try {
      const sessionState = createSessionState()
      const server = await getServerImpl(gcpInfo, sessionState, req.verifiedPrincipal || null)
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
 * Returns whether the `enable_api` tool should be registered for this server.
 * Skipped in Google-managed OAuth mode (the maintainer's project has APIs
 * pre-enabled, so end users never need to call it). Registered in all other
 * modes (custom OAuth client, bearer header, service-account key) defensively.
 * @returns {boolean} True if `enable_api` should be registered.
 */
function shouldRegisterEnableApi() {
  try {
    const config = resolveOAuthClientConfig()
    return config.source !== 'managed'
  } catch {
    return true
  }
}

/**
 * Initializes and configures the MCP server instance.
 * @param {object} gcpInfo - The detected GCP environment metadata.
 * @param {object} sharedSessionState - The shared session state for cross-request persistence.
 * @param {?import('./lib/util/credential/jwt_verifier.js').VerifiedPrincipal} [principal] - The verified principal for this HTTP request, when present. Null in stdio mode and HTTP mode without CEP_BEARER_AUDIENCE.
 * @returns {Promise<McpServer>} The configured MCP server instance.
 */
export async function getServer(gcpInfo, sharedSessionState, principal = null) {
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

  installPrettyValidationErrors(server)

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

  if (principal) {
    logger.debug(`${TAGS.MCP} Request authenticated as ${principal.email} (sub=${principal.sub})`)
  }

  const apiClients = {
    adminSdk: new AdminSdkClient(apiOptions),
    cloudIdentity: new CloudIdentityClient(apiOptions),
    chromePolicy: new ChromePolicyClient(apiOptions),
    chromeManagement: new ChromeManagementClient(apiOptions),
    serviceUsage: new ServiceUsageClient(apiOptions),
  }

  const toolOptions = {
    apiClients,
    apiOptions,
    dbPath: process.env.KNOWLEDGE_DB_PATH,
    featureFlags,
    registerEnableApi: shouldRegisterEnableApi(),
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
    const probe = await probeOAuthFlow(requiredScopes)
    let oauthClientConfig = null
    try {
      oauthClientConfig = resolveOAuthClientConfig()
    } catch {
      // Resolution failures fall through to the unresolved banner field.
    }

    const printServerStatus = assignedPort => {
      printBanner({
        transport: isStdio ? 'Stdio' : ['SSE/HTTP', `(Port: ${assignedPort})`],
        auth: isStdio ? ['None', '(Local channel)'] : ['None', '(Unauthenticated)'],
        apiCreds: buildApiCredsField(probe, oauthClientConfig),
        scopes: buildScopesField(probe, requiredScopes),
        dataAccess: process.env.GOOGLE_API_ROOT_URL ? 'Fake' : 'Production',
        knowledge: ['lib/knowledge', `(${articleCount} articles)`],
      })
      const remediation = buildAuthRemediationLines(probe, requiredScopes)
      if (remediation) {
        console.log()
        for (const line of remediation) {
          console.log(dim(line))
        }
        console.log()
      }
      console.log(dim(`Active Experiments: ${activeExps}`))
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
      const lockedSub = process.env.CEP_BEARER_PRINCIPAL_SUB || ''
      if (lockedSub && !expectedAudience) {
        logger.warn(
          `${TAGS.MCP} CEP_BEARER_PRINCIPAL_SUB has no effect without CEP_BEARER_AUDIENCE.\n` +
            `To lock the server to one user, set both: CEP_BEARER_AUDIENCE turns on bearer-token verification, and CEP_BEARER_PRINCIPAL_SUB narrows access to that user.`,
        )
      }
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
          const result = await verifyBearerToken(token, { expectedAudience, lockedSub, verify: verifyIdToken })
          if (!result.ok) {
            if (result.status === 403) {
              logger.warn(
                `${TAGS.MCP} Principal sub ${result.principal.sub} does not match CEP_BEARER_PRINCIPAL_SUB; rejecting`,
              )
            } else if (result.error) {
              logger.warn(`${TAGS.MCP} ID-token verification failed: ${result.error.message}`)
            }
            res.status(result.status).json({ error: result.message })
            return
          }
          // eslint-disable-next-line require-atomic-updates
          req.verifiedPrincipal = result.principal
          next()
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
        res.status(405).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Method not allowed.' },
          id: null,
        })
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
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'No transport found for the provided sessionId.' },
            id: null,
          })
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
