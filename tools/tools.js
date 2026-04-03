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
import { registerCreateChromeDlpRuleTool } from './definitions/create_chrome_dlp_rule.js'
import { registerGetChromeActivityLogTool } from './definitions/get_chrome_activity_log.js'
import { registerDeleteAgentDlpRuleTool } from './definitions/delete_agent_dlp_rule.js'
import { registerGetConnectorPolicyTool } from './definitions/get_connector_policy.js'
import { registerListOrgUnitsTool } from './definitions/list_org_units.js'
import { registerGetCustomerIdTool } from './definitions/get_customer_id.js'
import { registerListDetectorsTool } from './definitions/list_detectors.js'
import { registerCreateUrlListDetectorTool } from './definitions/create_url_list_detector.js'
import { registerCreateWordListDetectorTool } from './definitions/create_word_list_detector.js'
import { registerCreateRegexDetectorTool } from './definitions/create_regex_detector.js'
import { registerDeleteDetectorTool } from './definitions/delete_detector.js'
import { registerCreateDefaultDlpRulesTool } from './definitions/create_default_dlp_rules.js'
import { registerCheckCepSubscriptionTool } from './definitions/check_cep_subscription.js'
import { registerCheckUserCepLicenseTool } from './definitions/check_user_cep_license.js'
import { registerCheckSebExtensionStatusTool } from './definitions/check_seb_extension_status.js'
import { registerInstallSebExtensionTool } from './definitions/install_seb_extension.js'
import { registerCheckAndEnableApiTool } from './definitions/check_and_enable_api.js'
import { registerEnableChromeEnterpriseConnectorsTool } from './definitions/enable_chrome_enterprise_connectors.js'

/**
 * Registers all tools with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} [options={}] - Configuration options for the tools.
 * @param {object} [sessionState] - Shared session state object.
 */
function registerAllTools(server, options = {}, sessionState) {
  const apiOptions = options.apiOptions || {}
  const state = sessionState || { customerId: null, cachedRootOrgUnitId: null }
  const {
    adminSdk: adminSdkClient,
    cloudIdentity: cloudIdentityClient,
    chromePolicy: chromePolicyClient,
    chromeManagement: chromeManagementClient,
    serviceUsage: serviceUsageClient,
  } = options.apiClients || {}

  const commonOpts = { ...options, apiOptions }

  registerCountBrowserVersionsTool(server, { ...commonOpts, chromeManagementClient }, state)
  registerCustomerProfileTool(server, { ...commonOpts, chromeManagementClient }, state)
  registerListDlpRulesTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerCreateChromeDlpRuleTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerDeleteAgentDlpRuleTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerListDetectorsTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerCreateUrlListDetectorTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerCreateWordListDetectorTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerCreateRegexDetectorTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerDeleteDetectorTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerGetChromeActivityLogTool(server, { ...commonOpts, adminSdkClient }, state)
  registerGetConnectorPolicyTool(server, { ...commonOpts, chromePolicyClient }, state)
  registerListOrgUnitsTool(server, { ...commonOpts, adminSdkClient }, state)
  registerGetCustomerIdTool(server, { ...commonOpts, adminSdkClient }, state)
  registerCheckCepSubscriptionTool(server, { ...commonOpts, adminSdkClient }, state)
  registerCheckUserCepLicenseTool(server, { ...commonOpts, adminSdkClient }, state)
  registerCreateDefaultDlpRulesTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerCheckSebExtensionStatusTool(server, { ...commonOpts, chromePolicyClient }, state)
  registerInstallSebExtensionTool(server, { ...commonOpts, chromePolicyClient }, state)
  registerCheckAndEnableApiTool(server, { ...commonOpts, serviceUsageClient }, state)
  registerEnableChromeEnterpriseConnectorsTool(server, { ...commonOpts, chromePolicyClient }, state)
}

/**
 * Registers tools for local execution.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} [options={}] - Configuration options.
 * @param {object} [sessionState] - Shared session state object.
 */
export const registerTools = (server, options = {}, sessionState) => {
  registerAllTools(server, options, sessionState)
}

/**
 * Registers tools for remote execution (e.g., on Cloud Run).
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} [options={}] - Configuration options.
 * @param {object} [sessionState] - Shared session state object.
 */
export const registerToolsRemote = (server, options = {}, sessionState) => {
  registerAllTools(server, options, sessionState)
}
