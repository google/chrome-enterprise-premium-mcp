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
 * @file Registers all tools with the MCP server.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TAGS } from '../lib/constants.js'
import { logger } from '../lib/util/logger.js'

import { registerGetCustomerIdTool } from './definitions/get_customer_id.js'
import { registerListOrgUnitsTool } from './definitions/list_org_units.js'
import { registerCheckCepSubscriptionTool } from './definitions/check_cep_subscription.js'
import { registerCheckUserCepLicenseTool } from './definitions/check_user_cep_license.js'
import { registerCountBrowserVersionsTool } from './definitions/count_browser_versions.js'
import { registerCustomerProfileTool } from './definitions/list_customer_profiles.js'
import { registerGetConnectorPolicyTool } from './definitions/get_connector_policy.js'
import { registerGetChromeActivityLogTool } from './definitions/get_chrome_activity_log.js'
import { registerListDlpRulesTool } from './definitions/list_dlp_rules.js'
import { registerGetDlpRuleTool } from './definitions/get_dlp_rule.js'
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
import { registerCheckAndEnableCepApiTool } from './definitions/check_and_enable_cep_api.js'
import { registerEnableChromeEnterpriseConnectorsTool } from './definitions/enable_chrome_enterprise_connectors.js'
import { registerDiagnoseEnvironmentTool } from './definitions/diagnose_environment.js'
import { registerKnowledgeTools } from './definitions/knowledge.js'
import { featureFlags as defaultFlags, FLAGS, FeatureFlags } from '../lib/util/feature_flags.js'
import { GuardedToolOptions, SessionState } from './utils/wrapper.js'

export interface RegisterToolsOptions extends GuardedToolOptions {
  featureFlags?: FeatureFlags
}

/**
 * Registers all tools with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tools.
 * @param sessionState The session state object for caching.
 */
export function registerTools(
  server: McpServer,
  options: RegisterToolsOptions = {},
  sessionState?: SessionState,
): void {
  const { apiClients = {}, featureFlags: flags = defaultFlags } = options

  const apiOptions = options.apiOptions || {}
  const commonOpts: GuardedToolOptions = { apiOptions, apiClients }

  logger.debug(`${TAGS.MCP} Registering all tools...`)

  const state: SessionState = sessionState || { customerId: null }

  registerGetCustomerIdTool(server, commonOpts, state)
  registerListOrgUnitsTool(server, commonOpts, state)
  registerCheckCepSubscriptionTool(server, commonOpts, state)
  registerCheckUserCepLicenseTool(server, commonOpts, state)
  registerCountBrowserVersionsTool(server, commonOpts, state)
  registerCustomerProfileTool(server, commonOpts, state)
  registerGetConnectorPolicyTool(server, commonOpts, state)
  registerGetChromeActivityLogTool(server, commonOpts, state)
  registerListDlpRulesTool(server, commonOpts, state)
  registerGetDlpRuleTool(server, commonOpts, state)
  registerListDetectorsTool(server, commonOpts, state)
  registerCreateChromeDlpRuleTool(server, commonOpts, state)

  if (flags.isEnabled(FLAGS.DELETE_TOOL_ENABLED, false)) {
    logger.debug(`${TAGS.MCP} Registering delete tools (EXPERIMENT_DELETE_TOOL_ENABLED is active)`)
    registerDeleteAgentDlpRuleTool(server, commonOpts, state)
    registerDeleteDetectorTool(server, commonOpts, state)
  }

  registerCreateRegexDetectorTool(server, commonOpts, state)
  registerCreateUrlListDetectorTool(server, commonOpts, state)
  registerCreateWordListDetectorTool(server, commonOpts, state)
  registerCreateDefaultDlpRulesTool(server, commonOpts, state)
  registerCheckSebExtensionStatusTool(server, commonOpts, state)
  registerInstallSebExtensionTool(server, commonOpts, state)
  registerCheckAndEnableCepApiTool(server, commonOpts, state)
  registerEnableChromeEnterpriseConnectorsTool(server, commonOpts, state)

  if (flags.isEnabled(FLAGS.DIAGNOSE_TOOL_ENABLED, false)) {
    logger.debug(`${TAGS.MCP} Registering diagnose tool (EXPERIMENT_DIAGNOSE_TOOL_ENABLED is active)`)
    registerDiagnoseEnvironmentTool(server, commonOpts, state)
  }

  registerKnowledgeTools(server, { ...options, featureFlags: flags }, state)
}
