/**
 * @fileoverview MCP Tool Registration Entry Point.
 *
 * Provides functions to register all available tools with the MCP server.
 * Supports both local and remote execution modes.
 */

import { registerCountBrowserVersionsTool } from './definitions/count_browser_versions.js'
import { registerCustomerProfileTool } from './definitions/list_customer_profiles.js'
import { registerListDlpRulesTool } from './definitions/list_dlp_rules.js'
import { registerCreateDlpRuleTool } from './definitions/create_dlp_rule.js'
import { registerGetChromeActivityLogTool } from './definitions/get_chrome_activity_log.js'
import { registerAnalyzeChromeLogsTool } from './definitions/analyze_chrome_logs.js'
import { registerDeleteDlpRuleTool } from './definitions/delete_dlp_rule.js'
import { registerCreateUrlListTool } from './definitions/create_url_list.js'
import { registerGetConnectorPolicyTool } from './definitions/get_connector_policy.js'
import { registerListOrgUnitsTool } from './definitions/list_org_units.js'
import { registerGetCustomerIdTool } from './definitions/get_customer_id.js'
import { setGlobalCustomerId } from './utils.js'

/**
 * Registers all tools with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} [options={}] - Configuration options for the tools.
 */
function registerAllTools(server, options = {}) {
    if (options.customerId) {
        setGlobalCustomerId(options.customerId)
    }

    registerCountBrowserVersionsTool(server, options)
    registerCustomerProfileTool(server, options)
    registerListDlpRulesTool(server, options)
    registerCreateDlpRuleTool(server, options)
    registerGetChromeActivityLogTool(server, options)
    registerAnalyzeChromeLogsTool(server, options)
    registerDeleteDlpRuleTool(server, options)
    registerCreateUrlListTool(server, options)
    registerGetConnectorPolicyTool(server, options)
    registerListOrgUnitsTool(server, options)
    registerGetCustomerIdTool(server, options)
}

/**
 * Registers tools for local execution.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} [options={}] - Configuration options.
 */
export const registerTools = (server, options = {}) => {
    registerAllTools(server, options)
}

/**
 * Registers tools for remote execution (e.g., on Cloud Run).
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} [options={}] - Configuration options.
 */
export const registerToolsRemote = (server, options = {}) => {
    registerAllTools(server, options)
}
