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
import { CONNECTOR_KEY_MAPPING, POLICY_DISPLAY_NAMES, EVENT_NAME_MAPPING } from '../../lib/constants.js'
import { ConnectorPolicyFilter } from '../../lib/api/chromepolicy.js'

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
Use this to AUDIT or VERIFY settings for features like "printing sensitive data", "real-time URL checks", or "event reporting".
To enable or modify a connector that is not yet configured, use the "enable_chrome_enterprise_connectors" tool.`,
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
          const POLICY_LINK_MAPPING = {
            ON_FILE_ATTACHED: 'file_attached',
            ON_FILE_DOWNLOAD: 'file_downloaded',
            ON_BULK_TEXT_ENTRY: 'bulk_text_entry',
            ON_PRINT: 'print_analysis_connector',
            ON_REALTIME_URL_NAVIGATION: 'realtime_url_check',
            ON_SECURITY_EVENT: 'on_security_event',
          }

          const manualUpdateLink = `https://admin.google.com/ac/chrome/settings/user/details/${POLICY_LINK_MAPPING[policy]}`

          const policies = await chromePolicyClient.getConnectorPolicy(
            customerId,
            orgUnitId,
            ConnectorPolicyFilter[policy],
            authToken,
          )

          const displayName = POLICY_DISPLAY_NAMES[policy] || policy

          return safeFormatResponse({
            rawData: policies,
            toolName: 'get_connector_policy',
            formatFn: raw => {
              /**
               * Recursively traverses a deeply nested Chrome Policy config object,
               * flattens it into a single-level dictionary, humanizes raw ENUM
               * values (e.g., 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM' -> 'Chrome Enterprise Premium'),
               * and maps internal keys to user-friendly labels using CONNECTOR_KEY_MAPPING.
               * @param {object} obj - The raw, nested policy value object from the API.
               * @param {string[]} warnings - Array to accumulate warnings about key collisions.
               * @returns {object} A flattened, human-readable dictionary representing the policy settings.
               */
              function flattenAndMapConfig(obj, warnings = []) {
                const result = {}
                const humanize = val => {
                  if (typeof val === 'boolean') {
                    return val ? 'Yes' : 'No'
                  }
                  if (Array.isArray(val)) {
                    return val.map(humanize).join(', ')
                  }
                  if (typeof val !== 'string') {
                    return String(val)
                  }
                  if (EVENT_NAME_MAPPING[val]) {
                    return EVENT_NAME_MAPPING[val]
                  }
                  return val
                    .replace(/^[A-Z_]+_ENUM_/, '')
                    .replace(/^SERVICE_PROVIDER_/, '')
                    .replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/\b\w/g, c => c.toUpperCase())
                }

                const walk = o => {
                  if (!o || typeof o !== 'object') {
                    return
                  }
                  for (const [k, v] of Object.entries(o)) {
                    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
                      // Handle arrays of configuration objects (e.g., printConfigurations)
                      // Take the first element as per requirements.
                      walk(v[0])
                    } else if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
                      walk(v)
                    } else {
                      const mappedKey = CONNECTOR_KEY_MAPPING[k]
                        ? `${k} (describe to user as '${CONNECTOR_KEY_MAPPING[k]}')`
                        : k
                      if (result[mappedKey] !== undefined) {
                        warnings.push(`Key collision detected for '${mappedKey}' during object flattening.`)
                      }
                      result[mappedKey] = humanize(v)
                    }
                  }
                }
                walk(obj)
                return result
              }

              const formattedPolicies = raw.map(p => {
                const v = p.value?.value || {}
                const warnings = []
                const flattened = flattenAndMapConfig(v, warnings)

                if (policy === 'ON_SECURITY_EVENT') {
                  const eventCfg =
                    v.reportingConnector?.setting?.eventConfiguration || v.reportingConnector?.eventConfiguration
                  const events = eventCfg?.enabledEventNames || []
                  const explicitlyEmpty = eventCfg?.explicitlyEmptyEventNames
                  const coreEvents = [
                    'contentTransferEvent',
                    'dangerousDownloadEvent',
                    'sensitiveDataEvent',
                    'urlFilteringInterstitialEvent',
                    'suspiciousUrlEvent',
                  ]

                  if (!eventCfg) {
                    warnings.push(
                      'Connector is not enabled. You can enable it using the enable_chrome_enterprise_connectors tool.',
                    )
                  } else {
                    let missingCoreEvents = []
                    if (events.length > 0) {
                      missingCoreEvents = coreEvents.filter(e => !events.includes(e))
                    } else if (explicitlyEmpty) {
                      missingCoreEvents = coreEvents
                    }

                    if (missingCoreEvents.length > 0) {
                      const mappedMissing = missingCoreEvents.map(e => EVENT_NAME_MAPPING[e] || e)
                      warnings.push(
                        `Missing core DLP events: ${mappedMissing.join(', ')}. Update settings manually at ${manualUpdateLink}`,
                      )
                    } else if (events.length === 0 && !explicitlyEmpty) {
                      flattened['Reporting Status'] = 'All Core Events Enabled (Default)'
                    }
                  }
                } else if (policy !== 'ON_REALTIME_URL_NAVIGATION') {
                  // Non-Reporting Connectors (Upload, Download, Paste, Print)
                  const cfg =
                    v.onFileAttachedAnalysisConnectorConfiguration?.fileAttachedConfiguration ||
                    v.onFileDownloadedAnalysisConnectorConfiguration?.fileDownloadedConfiguration ||
                    v.onBulkTextEntryAnalysisConnectorConfiguration?.bulkTextEntryConfiguration ||
                    v.onPrintAnalysisConnectorConfiguration?.printConfigurations?.[0] ||
                    v

                  const isCEP = cfg.serviceProvider === 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM'
                  const isNone = !cfg.serviceProvider || cfg.serviceProvider === 'SERVICE_PROVIDER_NONE'

                  if (isCEP) {
                    if (!cfg.delayDeliveryUntilVerdict && !cfg.delay_delivery_until_verdict) {
                      warnings.push(
                        `Delay enforcement is disabled. Users are unprotected during content analysis. Update settings manually at ${manualUpdateLink}`,
                      )
                    }
                    if (cfg.malwareUrlPatterns?.length > 0 || cfg.sensitiveUrlPatterns?.length > 0) {
                      warnings.push(
                        `Security posture is limited due to URL allowlisting. Update settings manually at ${manualUpdateLink}`,
                      )
                    }
                  } else if (isNone) {
                    warnings.push(
                      'Connector is not enabled. You can enable it using the enable_chrome_enterprise_connectors tool.',
                    )
                  } else {
                    warnings.push(
                      `3rd party provider detected. Integrated CEP features may be bypassed. Update settings manually at ${manualUpdateLink}`,
                    )
                  }
                }

                if (warnings.length > 0) {
                  flattened['warnings'] = warnings.join('; ')
                }

                // The 'flattened' object contains key-value pairs representing the connector policy settings.
                // Keys are either the original API keys or a user-friendly description.
                // Values are humanized versions of the policy settings (e.g., booleans as 'Yes'/'No', enums as readable strings).
                return flattened
              })

              const allWarnings = formattedPolicies.flatMap(p => (p.warnings ? [p.warnings] : []))
              let summaryStr = `Connector policy: ${displayName} (OU: \`${orgUnitId}\`)\nStatus: ${raw.length > 0 ? 'Configured' : 'Not configured'}`
              if (allWarnings.length > 0) {
                summaryStr += `\n\n⚠️ WARNINGS:\n- ${allWarnings.join('\n- ')}`
              }

              return formatToolResponse({
                summary: summaryStr,
                data: formattedPolicies,
                structuredContent: {
                  connectorPolicies: formattedPolicies,
                  connectorType: policy,
                  orgUnitId,
                  configured: raw.length > 0,
                },
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
