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
 * @fileoverview Tool definition for enabling multiple Chrome Enterprise Premium connectors.
 */

import { z } from 'zod'
import { guardedToolCall } from '../utils/wrapper.js'
import { inputSchemas, outputSchemas } from '../utils.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

const CONNECTOR_CONFIGS = {
  PRINT: {
    schema: 'chrome.users.OnPrintAnalysisConnectorPolicy',
    displayName: 'Print Analysis',
    check: policy => {
      const configs = policy?.value?.value?.onPrintAnalysisConnectorConfiguration?.printConfigurations
      return configs && configs.some(c => c.serviceProvider !== 'SERVICE_PROVIDER_UNSPECIFIED')
    },
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
    check: policy => {
      const config = policy?.value?.value?.onBulkTextEntryAnalysisConnectorConfiguration?.bulkTextEntryConfiguration
      return config && config.serviceProvider !== 'SERVICE_PROVIDER_UNSPECIFIED'
    },
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
    check: policy => {
      const config = policy?.value?.value?.onFileDownloadedAnalysisConnectorConfiguration?.fileDownloadedConfiguration
      return config && config.serviceProvider !== 'SERVICE_PROVIDER_UNSPECIFIED'
    },
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
    check: policy => {
      const config = policy?.value?.value?.onFileAttachedAnalysisConnectorConfiguration?.fileAttachedConfiguration
      return config && config.serviceProvider !== 'SERVICE_PROVIDER_UNSPECIFIED'
    },
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
    check: policy => {
      return policy?.value?.value?.realtimeUrlCheckEnabled === 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_ENABLED'
    },
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
    check: policy => {
      const reportingConnector = policy?.value?.value?.reportingConnector
      return reportingConnector && Object.keys(reportingConnector).length > 0
    },
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
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerEnableChromeEnterpriseConnectorsTool(server, options, sessionState) {
  const { chromePolicyClient } = options
  logger.debug(`${TAGS.MCP} Registering 'enable_chrome_enterprise_connectors' tool...`)

  server.registerTool(
    'enable_chrome_enterprise_connectors',
    {
      description: `Enables and configures selected Chrome Enterprise connectors.
        - Print Analysis (PRINT)
        - Bulk Text Entry Analysis (paste) (BULK_TEXT_ENTRY)
        - File Download Analysis (FILE_DOWNLOAD)
        - Upload content analysis (FILE_UPLOAD)
        - Real-time URL check (REALTIME_URL_CHECK)
        - Event Reporting (ON_SECURITY_EVENT)

        CRITICAL: When responding to the user, you MUST use the public-facing names (e.g., "Upload content analysis") and NEVER output the internal IDs (e.g., "FILE_UPLOAD").

        It will ONLY apply changes to connectors that are not already configured.`,
      inputSchema: {
        customerId: inputSchemas.customerId,
        orgUnitId: inputSchemas.orgUnitId.describe(
          'The ID of the organizational unit where connectors will be enabled.',
        ),
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
    },
    guardedToolCall(
      {
        handler: async ({ customerId, orgUnitId, connectors }, { requestInfo, authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'enable_chrome_enterprise_connectors' for ${connectors.join(', ')}`)
          const results = []
          const batchRequests = []

          // Normalize Org Unit ID (Strip 'id:' prefix if present)
          const normalizedOrgUnitId = orgUnitId.startsWith('id:') ? orgUnitId.substring(3) : orgUnitId

          // 1. Safety Check: Parallelize policy resolution
          const resolvePromises = connectors.map(async connectorType => {
            const config = CONNECTOR_CONFIGS[connectorType]
            const resolvedPolicies = await chromePolicyClient.resolvePolicy(
              customerId,
              normalizedOrgUnitId,
              config.schema,
              authToken,
            )
            return { config, resolvedPolicies }
          })

          const resolutions = await Promise.all(resolvePromises)

          for (const { config, resolvedPolicies } of resolutions) {
            if (resolvedPolicies && resolvedPolicies.length > 0 && config.check(resolvedPolicies[0])) {
              results.push(`ℹ️ ${config.displayName} is already configured. Skipping update.`)
              continue
            }

            // 2. Prepare Request
            batchRequests.push(config.getRequest(normalizedOrgUnitId))
            results.push(`✅ ${config.displayName} marked for enablement.`)
          }

          // 3. Execute Batch
          if (batchRequests.length > 0) {
            await chromePolicyClient.batchModifyPolicy(customerId, normalizedOrgUnitId, batchRequests, authToken)
            results.push('\nSuccessfully applied all pending updates.')
          }

          return {
            content: [
              {
                type: 'text',
                text: results.join('\n'),
              },
            ],
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
