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
import { CONNECTOR_KEY_MAPPING, POLICY_DISPLAY_NAMES } from '../../lib/constants.js'
import { ConnectorPolicyFilter } from '../../lib/api/chrome_policy_client.js'
import { analyzeConnectorPolicy, humanize } from '../../lib/util/connector_policy_helper.js'

/**
 * Processes raw policy entries for a specific connector, flattening and analyzing them.
 * @param {string} policyKey - The connector policy key.
 * @param {Array<object>} raw - The raw policy entries from the API.
 * @returns {object} Object containing cleanedPolicies, allWarnings, and isConfigured.
 */
function processSinglePolicy(policyKey, raw) {
  const POLICY_LINK_MAPPING = {
    ON_FILE_ATTACHED: 'file_attached',
    ON_FILE_DOWNLOAD: 'file_downloaded',
    ON_BULK_TEXT_ENTRY: 'bulk_text_entry',
    ON_PRINT: 'print_analysis_connector',
    ON_REALTIME_URL_NAVIGATION: 'realtime_url_check',
    ON_SECURITY_EVENT: 'on_security_event',
  }

  const manualUpdateLink = `https://admin.google.com/ac/chrome/settings/user/details/${POLICY_LINK_MAPPING[policyKey]}`

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

    const walk = (o, prefix = '') => {
      if (!o || typeof o !== 'object') {
        return
      }
      for (const [k, v] of Object.entries(o)) {
        let targetKey = k
        if (prefix) {
          if (k.toLowerCase().startsWith(prefix.toLowerCase())) {
            targetKey = k
          } else {
            targetKey = prefix + k.charAt(0).toUpperCase() + k.slice(1)
          }
        }

        if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
          walk(v[0], prefix)
        } else if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
          let nextPrefix = prefix
          if (k.toLowerCase().includes('malware')) {
            nextPrefix = 'malware'
          } else if (k.toLowerCase().includes('sensitive')) {
            nextPrefix = 'sensitive'
          }
          walk(v, nextPrefix)
        } else {
          const humanizedValue = humanize(v)
          const mappedKey = CONNECTOR_KEY_MAPPING[targetKey]
            ? `${targetKey} (describe to user as '${CONNECTOR_KEY_MAPPING[targetKey]}')`
            : targetKey

          if (result[mappedKey] !== undefined && result[mappedKey] !== humanizedValue) {
            warnings.push(`Key collision detected for '${mappedKey}' during object flattening.`)
          }
          result[mappedKey] = humanizedValue
        }
      }
    }
    walk(obj)
    return { flattened: result }
  }

  const formattedPolicies = raw.map(p => {
    const v = p.value?.value || {}
    const localWarnings = []
    const { flattened } = flattenAndMapConfig(v, localWarnings)

    // Use shared logic for health/protection analysis
    const analysis = analyzeConnectorPolicy(policyKey, [p])

    // Process findings into tool-specific warning strings with links
    const findingWarnings = analysis.findings.map(f => {
      if (f.remediationType === 'manual') {
        return `${f.message}. Update settings manually at ${manualUpdateLink}`
      }
      return f.message
    })

    // If the connector itself is disabled, add the primary remediation guidance
    if (!analysis.isEnabled) {
      findingWarnings.push(
        'Connector is not enabled. You can enable it using the enable_chrome_enterprise_connectors tool.',
      )
    }

    const finalWarnings = [...localWarnings, ...findingWarnings]

    if (policyKey === 'ON_SECURITY_EVENT' && analysis.isEnabled) {
      const eventCfg = v.reportingConnector?.setting?.eventConfiguration || v.reportingConnector?.eventConfiguration
      const events = eventCfg?.enabledEventNames || []
      const explicitlyEmpty = eventCfg?.explicitlyEmptyEventNames
      if (events.length === 0 && !explicitlyEmpty && eventCfg) {
        flattened['Reporting Status'] = 'All Core Events Enabled (Default)'
      }
    }

    if (policyKey === 'ON_REALTIME_URL_NAVIGATION' && analysis.isEnabled) {
      flattened["serviceProvider (describe to user as 'Provider')"] = 'Chrome Enterprise Premium'
    }

    if (finalWarnings.length > 0) {
      flattened['warnings'] = finalWarnings.join('; ')
    }

    return { ...flattened, isEnabled: analysis.isEnabled, analysisFindings: finalWarnings }
  })

  const allWarnings = formattedPolicies.flatMap(p => p.analysisFindings || [])
  const anyEnabled = formattedPolicies.some(p => p.isEnabled)
  const isConfigured = raw.length > 0 && anyEnabled

  // Strip internal analysisFindings before returning
  const cleanedPolicies = formattedPolicies.map(({ analysisFindings: _analysisFindings, ...p }) => p)

  return {
    cleanedPolicies,
    allWarnings,
    isConfigured,
  }
}

/**
 * Registers the 'get_connector_policy' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerGetConnectorPolicyTool(server, options, sessionState) {
  const { chromePolicyClient } = options

  server.registerTool(
    'get_connector_policy',
    {
      description: `Retrieves the current configuration for a specific Chrome Enterprise connector or all connectors.
Use this to AUDIT or VERIFY settings for features like "printing sensitive data", "real-time URL checks", or "event reporting".
Note: The 'enable_chrome_enterprise_connectors' tool can only ACTIVATE connectors that are currently unconfigured. There is currently no tool to MODIFY an already configured connector; these must be updated manually in the Admin Console.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
        orgUnitId: z.string().describe('The ID of the organizational unit to check.'),
        policy: z
          .enum([...Object.keys(ConnectorPolicyFilter), 'ALL'])
          .optional()
          .default('ALL')
          .describe('The connector type to retrieve (or "ALL" to get all connectors in one call).'),
      },
      outputSchema: z.looseObject({
        connectorPolicies: z.array(
          z
            .looseObject({
              isEnabled: z.boolean().describe('Whether the connector is currently enabled.'),
              warnings: z
                .string()
                .optional()
                .describe('Semicolon-joined warnings for this policy entry, when present.'),
            })
            .describe(
              'Flattened, human-readable view of the resolved policy. Keys are humanized (for example "serviceProvider (describe to user as \'Provider\')") and values are humanized strings; the original Chrome Policy targetKey/value fields are not preserved.',
            ),
        ),
        connectorType: z.string(),
        orgUnitId: z.string(),
        configured: z.boolean().describe('True when at least one policy entry exists and any entry is enabled.'),
        connectors: z
          .record(
            z.string(),
            z.object({
              connectorPolicies: z.array(z.any()),
              configured: z.boolean(),
              warnings: z.array(z.string()),
            }),
          )
          .optional()
          .describe('Mapping of all connector types to their individual results. Only present when policy is ALL.'),
      }),
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
        handler: async ({ customerId, orgUnitId, policy = 'ALL' }, { _requestInfo, authToken }) => {
          if (policy === 'ALL') {
            const policiesToFetch = Object.keys(ConnectorPolicyFilter)
            const fetchResults = await Promise.all(
              policiesToFetch.map(async pKey => {
                try {
                  const res = await chromePolicyClient.getConnectorPolicy(
                    customerId,
                    orgUnitId,
                    ConnectorPolicyFilter[pKey],
                    authToken,
                  )
                  return { key: pKey, raw: res, success: true }
                } catch (err) {
                  return { key: pKey, raw: [], success: false, error: err }
                }
              }),
            )

            for (const res of fetchResults) {
              if (!res.success) {
                throw res.error
              }
            }

            const combinedRaw = {}
            const connectors = {}
            let combinedConnectorPolicies = []
            let combinedConfigured = false
            let combinedWarnings = []

            for (const { key, raw } of fetchResults) {
              combinedRaw[key] = raw
              const { cleanedPolicies, allWarnings, isConfigured } = processSinglePolicy(key, raw)

              connectors[key] = {
                connectorPolicies: cleanedPolicies,
                configured: isConfigured,
                warnings: allWarnings,
              }

              const annotatedPolicies = cleanedPolicies.map(p => ({
                ...p,
                connectorType: key,
              }))
              combinedConnectorPolicies = combinedConnectorPolicies.concat(annotatedPolicies)

              if (isConfigured) {
                combinedConfigured = true
              }

              const prefixedWarnings = allWarnings.map(w => `[${POLICY_DISPLAY_NAMES[key]}] ${w}`)
              combinedWarnings = combinedWarnings.concat(prefixedWarnings)
            }

            let summary = `## Chrome Enterprise Connector Policies (OU: \`${orgUnitId}\`)\n\n`
            for (const key of policiesToFetch) {
              const conn = connectors[key]
              const displayName = POLICY_DISPLAY_NAMES[key]
              const statusText = conn.configured ? '🟢 Configured' : '⚪ Not configured'
              summary += `- **${displayName} (${key}):** ${statusText}\n`
            }

            if (combinedWarnings.length > 0) {
              summary += `\n### ⚠️ WARNINGS:\n- ${combinedWarnings.join('\n- ')}`
            }

            return safeFormatResponse({
              rawData: combinedRaw,
              toolName: 'get_connector_policy',
              formatFn: () => {
                const payload = {
                  connectorPolicies: combinedConnectorPolicies,
                  connectorType: 'ALL',
                  orgUnitId,
                  configured: combinedConfigured,
                  warnings: combinedWarnings,
                  connectors,
                }

                return formatToolResponse({
                  summary,
                  data: payload,
                  structuredContent: payload,
                })
              },
            })
          }

          // Singular policy path (fully backward compatible)
          const policies = await chromePolicyClient.getConnectorPolicy(
            customerId,
            orgUnitId,
            ConnectorPolicyFilter[policy],
            authToken,
          )

          return safeFormatResponse({
            rawData: policies,
            toolName: 'get_connector_policy',
            formatFn: raw => {
              const { cleanedPolicies, allWarnings, isConfigured } = processSinglePolicy(policy, raw)

              const title = `${POLICY_DISPLAY_NAMES[policy]} (OU: \`${orgUnitId}\`)`
              const statusLine = `Status: ${isConfigured ? 'Configured' : 'Not configured'}`
              const warningSection = allWarnings.length > 0 ? `\n\n⚠️ WARNINGS:\n- ${allWarnings.join('\n- ')}` : ''

              const summary = `Connector policy: ${title}\n${statusLine}${warningSection}`

              const payload = {
                connectorPolicies: cleanedPolicies,
                connectorType: policy,
                orgUnitId,
                configured: isConfigured,
                warnings: allWarnings,
              }

              return formatToolResponse({
                summary,
                data: payload,
                structuredContent: payload,
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
