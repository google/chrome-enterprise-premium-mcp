/**
 * @fileoverview Registers all tools with the MCP server.
 */

import { TAGS } from '../lib/constants.js'
import { logger } from '../lib/util/logger.js'

// Import tool registration functions from definitions directory
import { registerGetCustomerIdTool } from './definitions/get_customer_id.js'
import { registerListOrgUnitsTool } from './definitions/list_org_units.js'
import { registerCheckCepSubscriptionTool } from './definitions/check_cep_subscription.js'
import { registerCheckUserCepLicenseTool } from './definitions/check_user_cep_license.js'
import { registerCountBrowserVersionsTool } from './definitions/count_browser_versions.js'
import { registerCustomerProfileTool } from './definitions/list_customer_profiles.js'
import { registerGetConnectorPolicyTool } from './definitions/get_connector_policy.js'
import { registerGetChromeActivityLogTool } from './definitions/get_chrome_activity_log.js'
import { registerListDlpRulesTool } from './definitions/list_dlp_rules.js'
import { registerListDetectorsTool } from './definitions/list_detectors.js'
import { registerCreateChromeDlpRuleTool } from './definitions/create_chrome_dlp_rule.js'
import { registerDeleteAgentDlpRuleTool } from './definitions/delete_agent_dlp_rule.js'
import { registerDeleteDetectorTool } from './definitions/delete_detector.js'
import { registerCreateRegexDetectorTool } from './definitions/create_regex_detector.js'
import { registerCreateUrlListDetectorTool } from './definitions/create_url_list_detector.js'
import { registerCreateWordListDetectorTool } from './definitions/create_word_list_detector.js'
import { registerCreateDefaultDlpRulesTool } from './definitions/create_default_dlp_rules.js'
import { registerCheckSebExtensionStatusTool } from './definitions/check_seb_extension_status.js'
import { registerInstallSebExtensionTool } from './definitions/install_seb_extension.js'
import { registerCheckAndEnableApiTool } from './definitions/check_and_enable_api.js'
import { registerEnableChromeEnterpriseConnectorsTool } from './definitions/enable_chrome_enterprise_connectors.js'
import { registerFeedbackTool } from './definitions/feedback.js'

/**
 * Registers all tools with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tools.
 * @param {import('../lib/api/interfaces/api_clients.js').ApiClients} options.apiClients - The API clients collection.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerTools(server, options = {}, sessionState) {
  const { apiClients = {} } = options
  const { adminSdk, chromeManagement, chromePolicy, cloudIdentity, serviceUsage } = apiClients

  const apiOptions = options.apiOptions || {}
  const commonOpts = { adminSdkClient: adminSdk, apiOptions, apiClients }
  const chromeManagementClient = chromeManagement
  const chromePolicyClient = chromePolicy
  const cloudIdentityClient = cloudIdentity
  const serviceUsageClient = serviceUsage

  logger.debug(`${TAGS.MCP} Registering all tools...`)

  const state = sessionState || {}

  registerGetCustomerIdTool(server, commonOpts, state)
  registerListOrgUnitsTool(server, commonOpts, state)
  registerCheckCepSubscriptionTool(server, commonOpts, state)
  registerCheckUserCepLicenseTool(server, commonOpts, state)
  registerCountBrowserVersionsTool(server, { ...commonOpts, chromeManagementClient }, state)
  registerCustomerProfileTool(server, { ...commonOpts, chromeManagementClient }, state)
  registerGetConnectorPolicyTool(server, { chromePolicyClient }, state)
  registerGetChromeActivityLogTool(server, { ...commonOpts, chromeManagementClient }, state)
  registerListDlpRulesTool(server, { cloudIdentityClient }, state)
  registerListDetectorsTool(server, { cloudIdentityClient }, state)
  registerCreateChromeDlpRuleTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerDeleteAgentDlpRuleTool(server, { cloudIdentityClient }, state)
  registerDeleteDetectorTool(server, { cloudIdentityClient }, state)
  registerCreateRegexDetectorTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerCreateUrlListDetectorTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerCreateWordListDetectorTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerCreateDefaultDlpRulesTool(server, { ...commonOpts, cloudIdentityClient }, state)
  registerCheckSebExtensionStatusTool(server, { ...commonOpts, chromePolicyClient }, state)
  registerInstallSebExtensionTool(server, { ...commonOpts, chromePolicyClient }, state)
  registerCheckAndEnableApiTool(server, { ...commonOpts, serviceUsageClient }, state)
  registerEnableChromeEnterpriseConnectorsTool(server, { ...commonOpts, chromePolicyClient }, state)
  registerFeedbackTool(server, { ...commonOpts }, state)
}
