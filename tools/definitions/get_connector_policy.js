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

import { z } from 'zod'
import { guardedToolCall, getAuthToken, inputSchemas, outputSchemas } from '../utils.js'

const ConnectorPolicyFilter = {
  ON_FILE_ATTACHED: 'chrome.users.OnFileAttachedConnectorPolicy',
  ON_FILE_DOWNLOAD: 'chrome.users.OnFileDownloadedConnectorPolicy',
  ON_BULK_TEXT_ENTRY: 'chrome.users.OnBulkTextEntryConnectorPolicy',
  ON_PRINT: 'chrome.users.OnPrintAnalysisConnectorPolicy',
  ON_REALTIME_URL_NAVIGATION: 'chrome.users.RealtimeUrlCheck',
  ON_SECURITY_EVENT: 'chrome.users.OnSecurityEvent',
}

const POLICY_DISPLAY_NAMES = {
  ON_FILE_ATTACHED: 'File Attachment Analysis',
  ON_FILE_DOWNLOAD: 'File Download Analysis',
  ON_BULK_TEXT_ENTRY: 'Bulk Text Entry Analysis',
  ON_PRINT: 'Print Analysis',
  ON_REALTIME_URL_NAVIGATION: 'Real-time URL Check',
  ON_SECURITY_EVENT: 'Security Event Reporting',
}

export function registerGetConnectorPolicyTool(server, options, sessionState) {
  const { chromePolicyClient } = options

  server.registerTool(
    'get_connector_policy',
    {
      description: `Retrieves configuration for Chrome Enterprise connectors.`,
      inputSchema: {
        customerId: inputSchemas.customerId,
        orgUnitId: inputSchemas.orgUnitId,
        policy: z.enum(Object.keys(ConnectorPolicyFilter)),
      },
      outputSchema: outputSchemas.connectorPolicies,
    },
    guardedToolCall(
      {
        handler: async ({ customerId, orgUnitId, policy }, { requestInfo }) => {
          const authToken = getAuthToken(requestInfo)
          const policies = await chromePolicyClient.getConnectorPolicy(
            customerId,
            orgUnitId,
            ConnectorPolicyFilter[policy],
            authToken,
          )

          const displayName = POLICY_DISPLAY_NAMES[policy] || policy
          const header = `Organizational Unit: ${orgUnitId}\nConnector: ${displayName}\n\n`

          const format = val => {
            if (val === undefined || val === null) {
              return 'Not set'
            }
            if (typeof val === 'boolean') {
              return val ? 'Enabled' : 'Disabled'
            }
            if (typeof val === 'object') {
              if (val.onByDefault !== undefined) {
                return val.onByDefault ? 'Enabled (Default)' : 'Disabled'
              }
              if (val.customUrlPatterns) {
                return val.customUrlPatterns.join(', ')
              }
              return JSON.stringify(val)
            }
            const s = String(val)
            if (s === 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM') {
              return 'Chrome Enterprise Premium (CEP)'
            }
            if (s === 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_ENABLED') {
              return 'Enabled (Standard)'
            }
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

          const getVal = (obj, key) => {
            if (obj[key] !== undefined) {
              return obj[key]
            }
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
            return obj[snakeKey]
          }

          const summary =
            policies.length === 0
              ? 'No policy configured.'
              : policies
                  .map(p => {
                    let v = p.value?.value || {}
                    if (typeof v === 'string') {
                      try {
                        v = JSON.parse(v)
                      } catch (e) {
                        // Fallback to raw string if not JSON
                      }
                    }

                    if (typeof v !== 'object' || v === null) {
                      return `  - Raw Value: ${JSON.stringify(v)}`
                    }

                    if (policy === 'ON_REALTIME_URL_NAVIGATION') {
                      return `  - Status: ${format(getVal(v, 'realtimeUrlCheckEnabled'))}\n  - Mode: ${format(getVal(v, 'realtimeUrlCheckMode'))}`
                    }

                    if (policy === 'ON_SECURITY_EVENT') {
                      const events =
                        getVal(getVal(v, 'reportingConnector') || {}, 'eventConfiguration')?.enabledEventNames || []
                      return `  - Reported Events: ${events.length > 0 ? events.join(', ') : 'None'}`
                    }

                    const cfg =
                      v.onFileAttachedAnalysisConnectorConfiguration?.fileAttachedConfiguration ||
                      v.onFileDownloadedAnalysisConnectorConfiguration?.fileDownloadedConfiguration ||
                      v.onBulkTextEntryAnalysisConnectorConfiguration?.bulkTextEntryConfiguration ||
                      v.onPrintAnalysisConnectorConfiguration?.printConfiguration ||
                      v

                    const patterns = []
                    if (getVal(cfg, 'sensitiveUrlPatterns')) {
                      patterns.push(`Sensitive URLs: ${format(getVal(cfg, 'sensitiveUrlPatterns'))}`)
                    }
                    if (getVal(cfg, 'malwareUrlPatterns')) {
                      patterns.push(`Malware URLs: ${format(getVal(cfg, 'malwareUrlPatterns'))}`)
                    }

                    return [
                      `  - Provider: ${format(getVal(cfg, 'serviceProvider'))}`,
                      `  - Delay Enforcement: ${format(getVal(cfg, 'delayDeliveryUntilVerdict'))}`,
                      `  - Block on Failure: ${format(getVal(cfg, 'blockFileOnContentAnalysisFailure') || getVal(cfg, 'blockUntilVerdict'))}`,
                      `  - Block Password Protected: ${format(getVal(cfg, 'blockPasswordProtectedFiles'))}`,
                      `  - Block Large Files: ${format(getVal(cfg, 'blockLargeFileTransfer'))}`,
                      ...patterns.map(p => `  - ${p}`),
                    ].join('\n')
                  })
                  .join('\n\n')

          return {
            content: [{ type: 'text', text: header + summary }],
            structuredContent: { connectorPolicies: policies },
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
