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
 * @file Tool definition for retrieving Chrome Enterprise connector policies.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse, safeFormatResponse } from '../utils/wrapper.js'
import { commonOutputSchemas } from './shared.js'

const ConnectorPolicyFilter = {
  ON_FILE_ATTACHED: 'chrome.users.OnFileAttachedConnectorPolicy',
  ON_FILE_DOWNLOAD: 'chrome.users.OnFileDownloadedConnectorPolicy',
  ON_BULK_TEXT_ENTRY: 'chrome.users.OnBulkTextEntryConnectorPolicy',
  ON_PRINT: 'chrome.users.OnPrintAnalysisConnectorPolicy',
  ON_REALTIME_URL_NAVIGATION: 'chrome.users.RealtimeUrlCheck',
  ON_SECURITY_EVENT: 'chrome.users.OnSecurityEvent',
}

const POLICY_DISPLAY_NAMES = {
  ON_FILE_ATTACHED: 'Upload content analysis',
  ON_FILE_DOWNLOAD: 'File Download Analysis',
  ON_BULK_TEXT_ENTRY: 'Bulk Text Entry Analysis (paste)',
  ON_PRINT: 'Print Analysis',
  ON_REALTIME_URL_NAVIGATION: 'Real-time URL check',
  ON_SECURITY_EVENT: 'Event Reporting',
}

const EVENT_NAME_MAPPING = {
  browserCrashEvent: 'Browser crash',
  browserExtensionInstallEvent: 'Browser extension install',
  contentTransferEvent: 'Content transfer',
  unscannedFileEvent: 'Content unscanned',
  dangerousDownloadEvent: 'Malware transfer',
  passwordChangedEvent: 'Password changed',
  passwordReuseEvent: 'Password reuse',
  sensitiveDataEvent: 'Sensitive data transfer',
  interstitialEvent: 'Unsafe site visit',
  urlFilteringInterstitialEvent: 'URL filtering interstitial',
  suspiciousUrlEvent: 'Suspicious URL',
}

/**
 * Registers the 'get_connector_policy' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerGetConnectorPolicyTool(server, options, sessionState) {
  const { chromePolicyClient } = options

  server.registerTool(
    'get_connector_policy',
    {
      description: `Retrieves the current configuration for a specific Chrome Enterprise connector.
Use this to AUDIT or VERIFY settings for features like "blocking screenshots", "printing sensitive data", "real-time URL checks", or "event reporting". 

To modify these settings, use 'enable_chrome_enterprise_connectors'.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
        orgUnitId: z.string().describe('The ID of the organizational unit to check.'),
        policy: z.enum(Object.keys(ConnectorPolicyFilter)).describe('The connector type to retrieve.'),
      },
      outputSchema: z
        .object({
          connectorPolicies: z.array(commonOutputSchemas.resolvedChromePolicy),
          connectorType: z.string(),
          orgUnitId: z.string(),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        /**
         * Handler for retrieving connector policies.
         * @param {object} params - The tool parameters.
         * @param {string} [params.customerId] - The Chrome customer ID.
         * @param {string} params.orgUnitId - The organizational unit ID.
         * @param {string} params.policy - The connector type to retrieve.
         * @param {object} context - The tool execution context.
         * @param {object} context._requestInfo - The request info object.
         * @param {string} context.authToken - The OAuth2 access token.
         * @returns {Promise<object>} The formatted tool response.
         */
        handler: async ({ customerId, orgUnitId, policy }, { _requestInfo, authToken }) => {
          const normalizedOrgUnitId = orgUnitId.startsWith('id:') ? orgUnitId.substring(3) : orgUnitId

          const policies = await chromePolicyClient.getConnectorPolicy(
            customerId,
            normalizedOrgUnitId,
            ConnectorPolicyFilter[policy],
            authToken,
          )

          return safeFormatResponse({
            rawData: policies,
            toolName: 'get_connector_policy',
            formatFn: raw => {
              const displayName = POLICY_DISPLAY_NAMES[policy] || policy
              const header = `Connector policy: ${displayName} (OU: \`${orgUnitId}\`)\n\n`

              /**
               * Retrieves a value from an object using either camelCase or snake_case key.
               * @param {object} obj - The object to retrieve from.
               * @param {string} key - The key to retrieve.
               * @returns {unknown} The retrieved value or undefined.
               */
              const getVal = (obj, key) => {
                if (!obj || typeof obj !== 'object') {
                  return undefined
                }
                if (obj[key] !== undefined) {
                  return obj[key]
                }
                const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
                return obj[snakeKey]
              }

              /**
               * Formats a policy value for user-friendly display.
               * @param {unknown} val - The value to format.
               * @returns {string} The formatted string.
               */
              const format = val => {
                if (val === undefined || val === null) {
                  return 'Not set'
                }
                if (typeof val === 'boolean') {
                  return val ? 'Enabled' : 'Disabled'
                }
                if (typeof val === 'object') {
                  if (getVal(val, 'onByDefault') !== undefined) {
                    return getVal(val, 'onByDefault') ? 'Enabled (Default)' : 'Disabled'
                  }
                  if (getVal(val, 'customUrlPatterns')) {
                    return getVal(val, 'customUrlPatterns').join(', ')
                  }
                  return JSON.stringify(val)
                }
                const s = String(val)
                if (s === 'REAL_TIME_CHECK_ENFORCED') {
                  return 'Enforced'
                }

                return s
                  .replace(/^[A-Z_]+_ENUM_/, '')
                  .replace(/^[A-Z_]+_MODE_/, '')
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, c => c.toUpperCase())
              }

              const summaryLines =
                raw.length === 0
                  ? ['No policy configured.']
                  : raw.map(p => {
                      const v = p.value?.value || {}
                      if (policy === 'ON_REALTIME_URL_NAVIGATION') {
                        const val = getVal(v, 'realtimeUrlCheckEnabled')
                        const status = format(val)
                        return `  - **Status**: ${status}`
                      }

                      if (policy === 'ON_SECURITY_EVENT') {
                        const reportingConnector = getVal(v, 'reportingConnector') || {}
                        const setting = getVal(reportingConnector, 'setting') || reportingConnector
                        const eventCfg = getVal(setting, 'eventConfiguration')

                        if (eventCfg === undefined) {
                          return '  - **Reported Events**: Disabled'
                        }

                        const events = getVal(eventCfg, 'enabledEventNames') || []
                        const explicitlyEmpty = getVal(eventCfg, 'explicitlyEmptyEventNames')

                        let eventSummary = 'None'
                        let warnings = ''

                        const coreEvents = [
                          'contentTransferEvent',
                          'dangerousDownloadEvent',
                          'sensitiveDataEvent',
                          'urlFilteringInterstitialEvent',
                          'suspiciousUrlEvent',
                        ]

                        /**
                         * Maps internal event names to human-readable names.
                         * @param {string} e - The internal event name.
                         * @returns {string} The human-readable event name.
                         */
                        const mapEvent = e => EVENT_NAME_MAPPING[e] || e

                        if (events.length > 0) {
                          eventSummary = events.map(mapEvent).join(', ')
                          const missingCoreEvents = coreEvents.filter(e => !events.includes(e))
                          if (missingCoreEvents.length > 0) {
                            warnings = `\n\n  ⚠️ WARNING: The following core DLP events are missing from your customized configuration: ${missingCoreEvents.map(mapEvent).join(', ')}. Without these, your security posture is incomplete.`
                          }
                        } else if (explicitlyEmpty) {
                          eventSummary = 'None'
                          warnings = `\n\n  ⚠️ WARNING: The following core DLP events are missing from your customized configuration: ${coreEvents.map(mapEvent).join(', ')}. Without these, your security posture is incomplete.`
                        } else {
                          eventSummary = 'Default (Core Events Enabled)'
                        }

                        return `  - **Reported Events**: ${eventSummary}${warnings}`
                      }

                      const cfg =
                        v.onFileAttachedAnalysisConnectorConfiguration?.fileAttachedConfiguration ||
                        v.onFileDownloadedAnalysisConnectorConfiguration?.fileDownloadedConfiguration ||
                        v.onBulkTextEntryAnalysisConnectorConfiguration?.bulkTextEntryConfiguration ||
                        v.onPrintAnalysisConnectorConfiguration?.printConfigurations?.[0] ||
                        v

                      const patterns = []
                      if (getVal(cfg, 'sensitiveUrlPatterns')) {
                        patterns.push(`**Sensitive URLs**: ${format(getVal(cfg, 'sensitiveUrlPatterns'))}`)
                      }
                      if (getVal(cfg, 'malwareUrlPatterns')) {
                        patterns.push(`**Malware URLs**: ${format(getVal(cfg, 'malwareUrlPatterns'))}`)
                      }

                      return [
                        `  - **Provider**: ${format(getVal(cfg, 'serviceProvider'))}`,
                        `  - **Delay Enforcement**: ${format(getVal(cfg, 'delayDeliveryUntilVerdict'))}`,
                        `  - **Block on Failure**: ${format(getVal(cfg, 'blockFileOnContentAnalysisFailure') || getVal(cfg, 'blockUntilVerdict'))}`,
                        `  - **Block Password Protected**: ${format(getVal(cfg, 'blockPasswordProtectedFiles'))}`,
                        `  - **Block Large Files**: ${format(getVal(cfg, 'blockLargeFileTransfer'))}`,
                        ...patterns.map(pat => `  - ${pat}`),
                      ].join('\n')
                    })

              const sc = {
                connectorPolicies: raw,
                connectorType: policy,
                orgUnitId: orgUnitId,
              }

              const text =
                header +
                summaryLines.join('\n\n') +
                '\n\n**Next Step**: Search the knowledge base for documentation to interpret these settings.'

              return formatToolResponse({
                summary: text,
                data: sc,
                structuredContent: sc,
              })
            },
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
