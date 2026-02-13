/**
 * @fileoverview MCP Prompt Registration Entry Point.
 *
 * Provides functions to register all available prompts with the MCP server.
 */

import { registerCepPrompt } from './definitions/cep.js'
import { registerDiagnosePrompt } from './definitions/diagnose.js'
import { registerMaturityPrompt } from './definitions/maturity.js'
import { registerNoisePrompt } from './definitions/noise.js'

/**
 * Registers all prompts with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export function registerPrompts(server) {
    registerCepPrompt(server)
    registerDiagnosePrompt(server)
    registerMaturityPrompt(server)
    registerNoisePrompt(server)
}
