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
import express, { Request, Response, NextFunction } from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

interface PackageJson {
  version: string
}

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as PackageJson

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
import { adcCredential } from './lib/util/credential/adc.js'
import { SessionState } from './tools/utils/wrapper.js'
import { isObject } from './lib/util/helpers.js'

// Import Clients
import { AdminSdkClient } from './lib/api/admin_sdk_client.js'
import { CloudIdentityClient } from './lib/api/cloud_identity_client.js'
import { ChromePolicyClient } from './lib/api/chrome_policy_client.js'
import { ChromeManagementClient } from './lib/api/chrome_management_client.js'
import { ServiceUsageClient } from './lib/api/service_usage_client.js'

interface GCPInfo {
  project: string
  region: string
}

interface McpRequest extends Request {
  verifiedPrincipal?: unknown
}

/**
 * Redirects console.log to console.error for compatibility with Stdio transport.
 * Stdio transport uses stdout for protocol messages, so logging must go to stderr.
 */
function makeLoggingCompatibleWithStdio(): void {
  console.log = console.error
  logger.enableStdioMode()
}

/**
 * Determines whether to start the server in Stdio mode.
 * @param gcpInfo The detected GCP environment metadata
 * @returns True if Stdio mode should be used, false otherwise
 */
function shouldStartStdio(gcpInfo: GCPInfo | null): boolean {
  if (process.env.GCP_STDIO === 'false' || (gcpInfo && gcpInfo.project)) {
    return false
  }
  return true
}

/**
 * Builds a fresh per-request session-state object. Each HTTP request must call
 * this so that resolved customerId / orgUnit data from one Workspace tenant
 * cannot bleed into a concurrent request from another.
 * @returns A new session-state object with all fields zeroed.
 */
export function createSessionState(): SessionState {
  return { customerId: null, cachedRootOrgUnitId: null, pendingRule: null, history: [] }
}

/**
 * Builds the Express handler for POST /mcp. Each invocation constructs a fresh
 * per-request sessionState via createSessionState() and passes it to getServer,
 * so concurrent requests cannot share customerId/orgUnit cache.
 * @param gcpInfo GCP environment metadata.
 * @param getServerImpl Override for tests.
 * @returns The Express request handler.
 */
export function createMcpPostHandler(
  gcpInfo: GCPInfo | null,
  getServerImpl: (gcpInfo: GCPInfo | null, sharedSessionState: SessionState) => Promise<McpServer> = getServer,
): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response): Promise<void> => {
    const sessionState = createSessionState()
    const server = await getServerImpl(gcpInfo, sessionState)
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
      res.on('close', () => {
        logger.info(`${TAGS.MCP} Request closed`)
        void transport.close()
        void server.close()
      })
    } catch (error) {
      logger.error(`${TAGS.MCP} Error handling MCP request:`, error)
      if (!res.headersSent) {
        const status = isObject(error) && typeof error.status === 'number' ? error.status : 500
        const message =
          error instanceof Error
            ? error.message
            : isObject(error) && typeof error.message === 'string'
              ? error.message
              : 'Internal server error'
        res.status(status).json({
          jsonrpc: '2.0',
          error: {
            code: status === 401 ? -32001 : -32603,
            message,
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
 * @param gcpInfo GCP environment metadata.
 * @param sseTransports Map of sessionId -> transport.
 * @param getServerImpl Override for tests.
 * @returns The Express request handler.
 */
export function createSseHandler(
  gcpInfo: GCPInfo | null,
  sseTransports: Record<string, SSEServerTransport>,
  getServerImpl: (gcpInfo: GCPInfo | null, sharedSessionState: SessionState) => Promise<McpServer> = getServer,
): (req: Request, res: Response) => Promise<void> {
  return async (_req: Request, res: Response): Promise<void> => {
    logger.info(`${TAGS.MCP} /sse Received request`)
    try {
      const sessionState = createSessionState()
      const server = await getServerImpl(gcpInfo, sessionState)
      const transport = new SSEServerTransport('/messages', res)
      sseTransports[transport.sessionId] = transport
      res.on('close', () => {
        delete sseTransports[transport.sessionId]
        void transport.close().catch(e => {
          logger.error(`${TAGS.MCP} Error closing SSE transport:`, e)
        })
        void server.close().catch(e => {
          logger.error(`${TAGS.MCP} Error closing SSE server:`, e)
        })
      })
      await server.connect(transport)
    } catch (error) {
      logger.error(`${TAGS.MCP} Error handling SSE request:`, error)
      if (!res.headersSent) {
        const message =
          error instanceof Error
            ? error.message
            : isObject(error) && typeof error.message === 'string'
              ? error.message
              : 'Internal server error'
        res.status(500).send(message)
      }
    }
  }
}

/**
 * Initializes and configures the MCP server instance.
 * @param gcpInfo The detected GCP environment metadata
 * @param sharedSessionState The shared session state for cross-request persistence
 * @returns The configured MCP server instance
 */
export async function getServer(gcpInfo: GCPInfo | null, sharedSessionState: SessionState): Promise<McpServer> {
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

  const apiOptions: Record<string, string> = {}

  if (process.env.GOOGLE_API_ROOT_URL) {
    apiOptions['rootUrl'] = process.env.GOOGLE_API_ROOT_URL
    logger.info(`${TAGS.MCP} TEST MODE: Real API clients redirected to ${apiOptions['rootUrl']}`)
  } else {
    logger.info(`${TAGS.MCP} Using REAL API clients.`)
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
export async function runServer(): Promise<void> {
  try {
    const gcpInfo = await checkGCP()
    const isStdio = shouldStartStdio(gcpInfo)

    if (isStdio) {
      makeLoggingCompatibleWithStdio()
    }

    // Log feature flag overrides
    Object.values(FLAGS).forEach(flag => {
      if (!featureFlags.isDefault(flag)) {
        const status = featureFlags.isEnabled(flag, false) ? 'ENABLED' : 'DISABLED'
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
        .map(flag => `${flag}=${featureFlags.isEnabled(flag, false)}`)
        .join(', ') || 'None'

    const requiredScopes = Object.values(SCOPES)
    const adc = await adcCredential().probe()

    const printServerStatus = (assignedPort?: number) => {
      printBanner({
        transport: isStdio ? 'Stdio' : ['SSE/HTTP', `(Port: ${assignedPort})`],
        auth: isStdio ? ['None', '(Local channel)'] : ['None', '(Unauthenticated)'],
        apiCreds: adc.ok ? ['ADC', adc.principal ? `(${adc.principal})` : '(detected)'] : ['ADC', '(not configured)'],
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
        app.use(async (req: McpRequest, res: Response, next: NextFunction) => {
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
            const errMsg = err instanceof Error ? err.message : String(err)
            logger.warn(`${TAGS.MCP} ID-token verification failed: ${errMsg}`)
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

      app.get('/mcp', (_req: Request, res: Response) => {
        logger.info(`${TAGS.MCP} Received GET MCP request`)
        res.status(405).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Method not allowed.' },
          id: null,
        })
      })

      const sseTransports: Record<string, SSEServerTransport> = {}

      app.get('/sse', createSseHandler(gcpInfo, sseTransports))

      app.post('/messages', (req: Request, res: Response) => {
        void (async () => {
          logger.info(`${TAGS.MCP} /messages Received request`)
          const sessionId = req.query.sessionId
          if (typeof sessionId === 'string') {
            const transport = sseTransports[sessionId]
            if (transport) {
              await transport.handlePostMessage(req, res, req.body)
            } else {
              logger.warn(`${TAGS.MCP} /messages: no transport found for sessionId: ${sessionId}`)
              res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'No transport found for the provided sessionId.' },
                id: null,
              })
            }
          } else {
            res.status(400).json({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Session ID must be a string.' },
              id: null,
            })
          }
        })()
      })

      const PORT = process.env.PORT || 0
      const httpServer = app.listen(PORT, () => {
        const address = httpServer.address()
        if (address && typeof address === 'object') {
          const assignedPort = address.port
          printServerStatus(assignedPort)
          // Use console.log directly so smoke tests waiting for this line
          // are not silenced by CEP_LOG_LEVEL=SILENT.
          console.log(`${TAGS.MCP} Chrome Enterprise Premium MCP server listening on port ${assignedPort}`)
        }
      })
      httpServer.on('error', (e: unknown) => {
        if (isObject(e) && e['code'] === 'EADDRINUSE') {
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

const shutdown = (): void => {
  logger.error(`${TAGS.MCP} Shutting down server...`)
  // eslint-disable-next-line n/no-process-exit
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Only auto-start when invoked directly; tests and bin/cli.js import this
// module without triggering the server.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runServer()
}
