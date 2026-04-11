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
 * @file Tool definition for enabling multiple Chrome Enterprise Premium connectors.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

const CONNECTOR_CONFIGS = {
  PRINT: {
    schema: 'chrome.users.OnPrintAnalysisConnectorPolicy',
    displayName: 'Print Analysis',
    /**
     * Checks if the print connector is already configured.
     * @param {object} policy - The resolved policy.
     * @returns {boolean} True if configured.
     */
    check: policy => {
      const configs = policy?.value?.value?.onPrintAnalysisConnectorConfiguration?.printConfigurations
      return configs && configs.some(c => c.serviceProvider !== 'SERVICE_PROVIDER_UNSPECIFIED')
    },
    /**
     * Returns the batch modify request for the print connector.
     * @param {string} orgUnitId - The target organizational unit ID.
     * @returns {object} The policy update request.
     */
    getRequest: orgUnitId => ({
      policyTargetKey: { targetResource: `orgunits/${orgUnitId}` },
      policyValue: {
        policySchema: 'chrome.users.OnPrintAnalysisConnectorPolicy',
        value: {
          onPrintAnalysisConnectorConfiguration: {
            printConfigurations: [
              {
                serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                delayDeliveryUntilVerdict: true,
                defaultAction: 'DEFAULT_ACTION_ALLOW',
                blockLargeFileTransfer: false,
                sensitiveUrlPatterns: { onByDefault: true },
              },
            ],
          },
        },
      },
      updateMask: 'onPrintAnalysisConnectorConfiguration',
    }),
  },
  BULK_TEXT_ENTRY: {
    schema: 'chrome.users.OnBulkTextEntryConnectorPolicy',
    displayName: 'Bulk Text Entry Analysis (paste)',
    /**
     * Checks if the bulk text entry connector is already configured.
     * @param {object} policy - The resolved policy.
     * @returns {boolean} True if configured.
     */
    check: policy => {
      const config = policy?.value?.value?.onBulkTextEntryAnalysisConnectorConfiguration?.bulkTextEntryConfiguration
      return config && config.serviceProvider !== 'SERVICE_PROVIDER_UNSPECIFIED'
    },
    /**
     * Returns the batch modify request for the bulk text entry connector.
     * @param {string} orgUnitId - The target organizational unit ID.
     * @returns {object} The policy update request.
     */
    getRequest: orgUnitId => ({
      policyTargetKey: { targetResource: `orgunits/${orgUnitId}` },
      policyValue: {
        policySchema: 'chrome.users.OnBulkTextEntryConnectorPolicy',
        value: {
          onBulkTextEntryAnalysisConnectorConfiguration: {
            bulkTextEntryConfiguration: {
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: true,
              defaultAction: 'DEFAULT_ACTION_ALLOW',
              minimumBytesToScan: 100,
              sensitiveUrlPatterns: { onByDefault: true },
            },
          },
        },
      },
      updateMask: 'onBulkTextEntryAnalysisConnectorConfiguration',
    }),
  },
  FILE_DOWNLOAD: {
    schema: 'chrome.users.OnFileDownloadedConnectorPolicy',
    displayName: 'File Download Analysis',
    /**
     * Checks if the file download connector is already configured.
     * @param {object} policy - The resolved policy.
     * @returns {boolean} True if configured.
     */
    check: policy => {
      const config = policy?.value?.value?.onFileDownloadedAnalysisConnectorConfiguration?.fileDownloadedConfiguration
      return config && config.serviceProvider !== 'SERVICE_PROVIDER_UNSPECIFIED'
    },
    /**
     * Returns the batch modify request for the file download connector.
     * @param {string} orgUnitId - The target organizational unit ID.
     * @returns {object} The policy update request.
     */
    getRequest: orgUnitId => ({
      policyTargetKey: { targetResource: `orgunits/${orgUnitId}` },
      policyValue: {
        policySchema: 'chrome.users.OnFileDownloadedConnectorPolicy',
        value: {
          onFileDownloadedAnalysisConnectorConfiguration: {
            fileDownloadedConfiguration: {
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: true,
              defaultAction: 'DEFAULT_ACTION_ALLOW',
              blockPasswordProtectedFiles: false,
              blockLargeFileTransfer: false,
              sensitiveUrlPatterns: { onByDefault: true },
              malwareUrlPatterns: { onByDefault: true },
            },
          },
        },
      },
      updateMask: 'onFileDownloadedAnalysisConnectorConfiguration',
    }),
  },
  FILE_UPLOAD: {
    schema: 'chrome.users.OnFileAttachedConnectorPolicy',
    displayName: 'Upload content analysis',
    /**
     * Checks if the file upload connector is already configured.
     * @param {object} policy - The resolved policy.
     * @returns {boolean} True if configured.
     */
    check: policy => {
      const config = policy?.value?.value?.onFileAttachedAnalysisConnectorConfiguration?.fileAttachedConfiguration
      return config && config.serviceProvider !== 'SERVICE_PROVIDER_UNSPECIFIED'
    },
    /**
     * Returns the batch modify request for the file upload connector.
     * @param {string} orgUnitId - The target organizational unit ID.
     * @returns {object} The policy update request.
     */
    getRequest: orgUnitId => ({
      policyTargetKey: { targetResource: `orgunits/${orgUnitId}` },
      policyValue: {
        policySchema: 'chrome.users.OnFileAttachedConnectorPolicy',
        value: {
          onFileAttachedAnalysisConnectorConfiguration: {
            fileAttachedConfiguration: {
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: true,
              defaultAction: 'DEFAULT_ACTION_ALLOW',
              blockPasswordProtectedFiles: false,
              blockLargeFileTransfer: false,
              sensitiveUrlPatterns: { onByDefault: true },
              malwareUrlPatterns: { onByDefault: true },
            },
          },
        },
      },
      updateMask: 'onFileAttachedAnalysisConnectorConfiguration',
    }),
  },
  REALTIME_URL_CHECK: {
    schema: 'chrome.users.RealtimeUrlCheck',
    displayName: 'Real-time URL check',
    /**
     * Checks if real-time URL check is already enabled.
     * @param {object} policy - The resolved policy.
     * @returns {boolean} True if enabled.
     */
    check: policy => {
      return policy?.value?.value?.realtimeUrlCheckEnabled === 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_ENABLED'
    },
    /**
     * Returns the batch modify request for real-time URL check.
     * @param {string} orgUnitId - The target organizational unit ID.
     * @returns {object} The policy update request.
     */
    getRequest: orgUnitId => ({
      policyTargetKey: { targetResource: `orgunits/${orgUnitId}` },
      policyValue: {
        policySchema: 'chrome.users.RealtimeUrlCheck',
        value: {
          realtimeUrlCheckEnabled: 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_ENABLED',
        },
      },
      updateMask: 'realtimeUrlCheckEnabled',
    }),
  },
  ON_SECURITY_EVENT: {
    schema: 'chrome.users.OnSecurityEvent',
    displayName: 'Event Reporting',
    /**
     * Checks if event reporting is already configured.
     * @param {object} policy - The resolved policy.
     * @returns {boolean} True if configured.
     */
    check: policy => {
      const reportingConnector = policy?.value?.value?.reportingConnector
      return reportingConnector && Object.keys(reportingConnector).length > 0
    },
    /**
     * Returns the batch modify request for event reporting.
     * @param {string} orgUnitId - The target organizational unit ID.
     * @returns {object} The policy update request.
     */
    getRequest: orgUnitId => ({
      policyTargetKey: { targetResource: `orgunits/${orgUnitId}` },
      policyValue: {
        policySchema: 'chrome.users.OnSecurityEvent',
        value: {
          reportingConnector: {
            eventConfiguration: {
              explicitlyEmptyEventNames: false,
            },
          },
        },
      },
      updateMask: 'reportingConnector',
    }),
  },
}

/**
 * Registers the 'enable_chrome_enterprise_connectors' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerEnableChromeEnterpriseConnectorsTool(server, options, sessionState) {
  const { chromePolicyClient } = options
  logger.debug(`${TAGS.MCP} Registering 'enable_chrome_enterprise_connectors' tool...`)

  server.registerTool(
    'enable_chrome_enterprise_connectors',
    {
      description: `Enables and configures selected Chrome Enterprise connectors (e.g., Print, Paste, File Upload/Download).
Use this tool to ACTIVATE security protections. It will ONLY apply changes to connectors that are not already configured. To check current status without modifying, use 'get_connector_policy'.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
        orgUnitId: z.string().describe('The ID of the organizational unit where connectors will be enabled.'),
        connectors: z
          .array(
            z.enum([
              'PRINT',
              'BULK_TEXT_ENTRY',
              'FILE_DOWNLOAD',
              'FILE_UPLOAD',
              'REALTIME_URL_CHECK',
              'ON_SECURITY_EVENT',
            ]),
          )
          .min(1)
          .describe('List of connectors to enable.'),
      },
      outputSchema: z
        .object({
          connectors: z.array(
            z
              .object({
                name: z.string(),
                displayName: z.string(),
                status: z.string(),
                wasModified: z.boolean(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        /**
         * Handler for enabling Chrome Enterprise connectors.
         * @param {object} params - The tool parameters.
         * @param {string} [params.customerId] - The Chrome customer ID.
         * @param {string} params.orgUnitId - The organizational unit ID.
         * @param {string[]} params.connectors - The list of connectors to enable.
         * @param {object} context - The tool execution context.
         * @param {object} context._requestInfo - The request info object.
         * @param {string} context.authToken - The OAuth2 access token.
         * @returns {Promise<object>} The formatted tool response.
         */
        handler: async ({ customerId, orgUnitId, connectors }, { _requestInfo, authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'enable_chrome_enterprise_connectors' for ${connectors.join(', ')}`)
          const connectorResults = []
          const batchRequests = []

          // Safety Check: Parallelize policy resolution
          const resolvePromises = connectors.map(async connectorType => {
            const config = CONNECTOR_CONFIGS[connectorType]
            const resolvedPolicies = await chromePolicyClient.resolvePolicy(
              customerId,
              orgUnitId,
              config.schema,
              authToken,
            )
            return { config, connectorType, resolvedPolicies }
          })

          const resolutions = await Promise.all(resolvePromises)

          for (const { config, connectorType, resolvedPolicies } of resolutions) {
            if (resolvedPolicies && resolvedPolicies.length > 0 && config.check(resolvedPolicies[0])) {
              connectorResults.push({
                name: connectorType,
                displayName: config.displayName,
                status: 'ALREADY_CONFIGURED',
                wasModified: false,
              })
              continue
            }

            // Prepare Request
            batchRequests.push(config.getRequest(orgUnitId))
            connectorResults.push({
              name: connectorType,
              displayName: config.displayName,
              status: 'ENABLED',
              wasModified: true,
            })
          }

          // Execute Batch
          if (batchRequests.length > 0) {
            await chromePolicyClient.batchModifyPolicy(customerId, orgUnitId, batchRequests, authToken)
          }

          const summaryLines = connectorResults.map(
            r => `- **${r.displayName}** — ${r.status.toLowerCase().replace(/_/g, ' ')}`,
          )

          const summary = `## Connector Enablement Results (${connectorResults.length})\n\n${summaryLines.join('\n')}`

          return formatToolResponse({
            summary,
            data: { connectors: connectorResults },
            structuredContent: { connectors: connectorResults },
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
