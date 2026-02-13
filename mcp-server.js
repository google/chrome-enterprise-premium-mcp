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
import { getCustomerId } from './lib/api/admin_sdk.js'
import { TAGS, DEFAULT_CONFIG } from './lib/constants.js'

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

    // Pre-fetch Customer ID to cache it globally
    let customerId
    try {
        const customer = await getCustomerId()
        if (customer && customer.id) {
            customerId = customer.id
            console.error(`${TAGS.MCP} Initialization: Retrieved Customer ID: ${customerId}`)
        }
    } catch (error) {
        console.error(`${TAGS.MCP} Initialization: Failed to retrieve Customer ID: ${error.message}`)
        // Proceed without it; tools will try to fetch it lazily if needed, or fail gracefully
    }

    if (shouldStartStdio(gcpInfo)) {
        console.error(`${TAGS.MCP} Using tools optimized for local or stdio mode.`)
        await ensureADCCredentials()

        registerTools(server, {
            defaultProjectId: effectiveProjectId,
            defaultRegion: effectiveRegion,
            gcpCredentialsAvailable: true, // Implied by ensureADCCredentials logic in tools
            customerId,
        })

        registerPrompts(server)
    } else {
        console.error(
            `${TAGS.MCP} Running on GCP project: ${effectiveProjectId}, region: ${effectiveRegion}. Using tools optimized for remote use.`,
        )

        registerToolsRemote(server, {
            defaultProjectId: effectiveProjectId,
            defaultRegion: effectiveRegion,
            gcpCredentialsAvailable: true,
            customerId,
        })

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
                    const transport = new StreamableHTTPServerTransport({
                        sessionIdGenerator: undefined,
                    })

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
                            error: {
                                code: -32603,
                                message: 'Internal server error',
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
                        error: {
                            code: -32000,
                            message: 'Method not allowed.',
                        },
                        id: null,
                    }),
                )
            })

            // Legacy SSE endpoint for backward compatibility
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
        throw new Error(error)
    }
}

// Handle server shutdown
process.on('SIGINT', async () => {
    console.error(`${TAGS.MCP} Shutting down server...`)
    return
})

main()
