#!/usr/bin/env node

/**
 * @fileoverview Chrome Enterprise Premium MCP Server Entry Point.
 *
 * Configures and starts the Model Context Protocol (MCP) server.
 * Supports both stdio (local) and SSE (remote/HTTP) transport modes.
 * Automatically detects the execution environment (local vs. GCP).
 */

import 'dotenv/config'
import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { registerTools, registerToolsRemote } from './tools/tools.js'
import { registerPrompts } from './prompts/index.js'
import { checkGCP } from './lib/util/gcp.js'
import { ensureADCCredentials } from './lib/util/auth.js'
import { TAGS, DEFAULT_CONFIG } from './lib/constants.js'

// Import Real Clients
import { RealAdminSdkClient } from './lib/api/real_admin_sdk_client.js'
import { RealCloudIdentityClient } from './lib/api/real_cloud_identity_client.js'
import { RealChromePolicyClient } from './lib/api/real_chrome_policy_client.js'
import { RealChromeManagementClient } from './lib/api/real_chrome_management_client.js'

// Import Fake Clients
import { FakeAdminSdkClient } from './lib/api/fake_admin_sdk_client.js'
import { FakeCloudIdentityClient } from './lib/api/fake_cloud_identity_client.js'
import { FakeChromePolicyClient } from './lib/api/fake_chrome_policy_client.js'
import { FakeChromeManagementClient } from './lib/api/fake_chrome_management_client.js'

/**
 * Redirects console.log to console.error for compatibility with Stdio transport.
 * Stdio transport uses stdout for protocol messages, so logging must go to stderr.
 */
function makeLoggingCompatibleWithStdio() {
    console.log = console.error
}

/**
 * Determines whether to start the server in Stdio mode.
 *
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
 *
 * @param {object} gcpInfo - The detected GCP environment metadata
 * @returns {Promise<McpServer>} The configured MCP server instance
 */
async function getServer(gcpInfo) {
    const server = new McpServer(
        {
            name: 'chrome-enterprise-premium',
            version: '1.0.0',
        },
        { capabilities: { logging: {}, prompts: {} } },
    )

    // No-op handler for setting log level (required for mcp-inspector)
    server.server.setRequestHandler(SetLevelRequestSchema, request => {
        console.debug(`${TAGS.MCP} Log Level set to: ${request.params.level}`)
        return {}
    })

    const envProjectId = process.env.GOOGLE_CLOUD_PROJECT
    const envRegion = process.env.GOOGLE_CLOUD_REGION

    // Determine effective configuration
    const effectiveProjectId = envProjectId || (gcpInfo && gcpInfo.project)
    const effectiveRegion = envRegion || (gcpInfo && gcpInfo.region) || DEFAULT_CONFIG.REGION

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
        }
    } else {
        console.error(`${TAGS.MCP} Using REAL API clients.`)
        apiClients = {
            adminSdk: new RealAdminSdkClient(apiOptions),
            cloudIdentity: new RealCloudIdentityClient(apiOptions),
            chromePolicy: new RealChromePolicyClient(apiOptions),
            chromeManagement: new RealChromeManagementClient(apiOptions),
        }
    }

    const toolOptions = {
        defaultProjectId: effectiveProjectId,
        defaultRegion: effectiveRegion,
        gcpCredentialsAvailable: true,
        apiClients,
        apiOptions,
    }

    if (shouldStartStdio(gcpInfo)) {
        console.error(`${TAGS.MCP} Using tools optimized for local or stdio mode.`)
        registerTools(server, toolOptions)
        registerPrompts(server)
    } else {
        console.error(
            `${TAGS.MCP} Running on GCP project: ${effectiveProjectId}, region: ${effectiveRegion}. Using tools optimized for remote use.`,
        )
        registerToolsRemote(server, toolOptions)
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

        if (isStdio) {
            makeLoggingCompatibleWithStdio()
            const stdioTransport = new StdioServerTransport()
            const server = await getServer(gcpInfo)
            await server.connect(stdioTransport)
            console.error(`${TAGS.MCP} Chrome Enterprise Premium MCP server stdio transport connected`)
        } else {
            console.log(`${TAGS.MCP} Stdio transport mode is turned off.`)
            const app = express()
            app.use(express.json())

            app.post('/mcp', async (req, res) => {
                const server = await getServer(gcpInfo)
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
                        res.status(500).json({
                            jsonrpc: '2.0',
                            error: { code: -32603, message: 'Internal server error' },
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
            app.get('/sse', async (req, res) => {
                console.log(`${TAGS.MCP} /sse Received request`)
                const server = await getServer(gcpInfo)
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
    process.exit(0)
})

main()
