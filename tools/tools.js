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
import { registerDeleteDlpRuleTool } from './definitions/delete_dlp_rule.js'
import { registerGetConnectorPolicyTool } from './definitions/get_connector_policy.js'
import { registerListOrgUnitsTool } from './definitions/list_org_units.js'
import { registerGetCustomerIdTool } from './definitions/get_customer_id.js'
import { registerListDetectorsTool } from './definitions/list_detectors.js'
import { registerCreateUrlListDetectorTool } from './definitions/create_url_list_detector.js'
import { registerCreateWordListDetectorTool } from './definitions/create_word_list_detector.js'
import { registerCreateRegexDetectorTool } from './definitions/create_regex_detector.js'
import { registerDeleteDetectorTool } from './definitions/delete_detector.js'

/**
 * Registers all tools with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} [options={}] - Configuration options for the tools.
 */
function registerAllTools(server, options = {}) {
  const apiOptions = options.apiOptions || {}
  const {
    adminSdk: adminSdkClient,
    cloudIdentity: cloudIdentityClient,
    chromePolicy: chromePolicyClient,
    chromeManagement: chromeManagementClient,
  } = options.apiClients || {}

  const commonOpts = { ...options, apiOptions }

  registerCountBrowserVersionsTool(server, { ...commonOpts, chromeManagementClient })
  registerCustomerProfileTool(server, { ...commonOpts, chromeManagementClient })
  registerListDlpRulesTool(server, { ...commonOpts, cloudIdentityClient })
  registerCreateDlpRuleTool(server, { ...commonOpts, cloudIdentityClient })
  registerDeleteDlpRuleTool(server, { ...commonOpts, cloudIdentityClient })
  registerListDetectorsTool(server, { ...commonOpts, cloudIdentityClient })
  registerCreateUrlListDetectorTool(server, { ...commonOpts, cloudIdentityClient })
  registerCreateWordListDetectorTool(server, { ...commonOpts, cloudIdentityClient })
  registerCreateRegexDetectorTool(server, { ...commonOpts, cloudIdentityClient })
  registerDeleteDetectorTool(server, { ...commonOpts, cloudIdentityClient })
  registerGetChromeActivityLogTool(server, { ...commonOpts, adminSdkClient })
  registerGetConnectorPolicyTool(server, { ...commonOpts, chromePolicyClient })
  registerListOrgUnitsTool(server, { ...commonOpts, adminSdkClient })
  registerGetCustomerIdTool(server, { ...commonOpts, adminSdkClient })
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
