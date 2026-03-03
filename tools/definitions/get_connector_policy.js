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
 * @fileoverview Tool definition for retrieving connector policies.
 */

import { z } from 'zod'

import { guardedToolCall, getAuthToken, inputSchemas } from '../utils.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

// Keep ConnectorPolicyFilter definition local as it's used in the inputSchema and handler
const ConnectorPolicyFilter = {
  ON_FILE_ATTACHED: 'chrome.users.OnFileAttachedConnectorPolicy',
  ON_FILE_DOWNLOAD: 'chrome.users.OnFileDownloadedConnectorPolicy',
  ON_BULK_TEXT_ENTRY: 'chrome.users.OnBulkTextEntryConnectorPolicy',
  ON_PRINT: 'chrome.users.OnPrintAnalysisConnectorPolicy',
  ON_REALTIME_URL_NAVIGATION: 'chrome.users.RealtimeUrlCheck',
  ON_SECURITY_EVENT: 'chrome.users.OnSecurityEvent',
}

/**
 * Registers the 'get_connector_policy' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
 */
export function registerGetConnectorPolicyTool(server, options) {
  const { chromePolicyClient } = options
  logger.debug(`${TAGS.MCP} Registering 'get_connector_policy' tool...`)

  server.registerTool(
    'get_connector_policy',
    {
      description: `This tool retrieves the configuration status for Chrome Enterprise connectors,
        specifically distinguishing between Content Analysis settings—ON_FILE_ATTACHED, ON_FILE_DOWNLOAD,
        ON_BULK_TEXT_ENTRY, ON_PRINT, ON_REALTIME_URL_NAVIGATION and ON_SECURITY_EVENT.
        It serves as the primary diagnostic engine to verify if the settings are set for DLP rules and data insights to be operational.
        For accurate DLP enforcement, the model must verify that the relevant Content Analysis connector has its serviceProvider set to
        SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM and delayDeliveryUntilVerdict set to true. Simultaneously, the model must audit the ON_SECURITY_EVENT
        to ensure event telemetry is active. Specifically, if this reporting configuration uses enabledEventNames, the model must validate that the
        five core DLP events—contentTransferEvent, dangerousDownloadEvent, sensitiveDataEvent, urlFilteringInterstitialEvent, and suspiciousUrlEvent—are
        explicitly included. If these reporting events are missing or the service provider is misconfigured, the customer must be informed that while a
        policy may be "active," the feedback loop for DLP rules and data insights will be broken. Please provide direct links to customers to resolve this issue ,
        this is the URL format - https://admin.google.com/ac/chrome/settings/user/details/{CONNECTOR_NAME}?ac_ouid={OrgUnitId} where CONNECTOR_NAME is
        file_attached, file_downloaded, bulk_text_entry, print_analysis_connector, realtime_url_check, on_security_event.`,
      inputSchema: {
        customerId: inputSchemas.customerId,
        orgUnitId: inputSchemas.orgUnitId.describe(`The ID of the organizational unit to filter results.`),
        policy: z.enum(Object.keys(ConnectorPolicyFilter)).describe(`The policy to filter by.`),
      },
    },
    guardedToolCall(
      {
        handler: async ({ customerId, orgUnitId, policy }, { requestInfo }) => {
          logger.debug(
            `${TAGS.MCP} Calling 'get_connector_policy' with customerId: ${customerId}, orgUnitId: ${orgUnitId}, policy: ${policy}`,
          )
          const authToken = getAuthToken(requestInfo)
          const policySchemaFilter = ConnectorPolicyFilter[policy]

          const policies = await chromePolicyClient.getConnectorPolicy(
            customerId,
            orgUnitId,
            policySchemaFilter,
            authToken,
          )

          logger.debug(`${TAGS.MCP} Successfully retrieved connector policy.`)
          return {
            content: [
              {
                type: 'text',
                text: `Connector policy for ${policy}:\n${JSON.stringify(policies, null, 2)}`,
              },
            ],
          }
        },
      },
      options,
    ),
  )
}
