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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  safeFormatResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { CONNECTOR_KEY_MAPPING, POLICY_DISPLAY_NAMES } from '../../lib/constants.js'
import { ConnectorPolicyFilter } from '../../lib/api/chrome_policy_client.js'
import { analyzeConnectorPolicy, humanize } from '../../lib/util/connector_policy_helper.js'
import { isObject, getObject } from '../../lib/util/helpers.js'

const policyKeys = [
  'ON_FILE_ATTACHED',
  'ON_FILE_DOWNLOAD',
  'ON_BULK_TEXT_ENTRY',
  'ON_PRINT',
  'ON_REALTIME_URL_NAVIGATION',
  'ON_SECURITY_EVENT',
  'ALL',
] as const

const GetConnectorPolicySchema = z.object({
  customerId: z.string().optional(),
  orgUnitId: z.string(),
  policy: z.enum(policyKeys).optional(),
})

type GetConnectorPolicyParams = z.infer<typeof GetConnectorPolicySchema>
interface FlattenResult {
  flattened: Record<string, unknown>
  warnings: string[]
}

/**
 * Recursively flattens nested connector policy configuration objects and maps
 * keys to user-friendly descriptive strings.
 */
export function flattenAndMapConfig(obj: unknown): FlattenResult {
  const result: Record<string, unknown> = {}
  const warnings: string[] = []

  const walk = (o: unknown, prefix = '') => {
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
        const mappedKey = CONNECTOR_KEY_MAPPING[targetKey as keyof typeof CONNECTOR_KEY_MAPPING]
          ? `${targetKey} (describe to user as '${CONNECTOR_KEY_MAPPING[targetKey as keyof typeof CONNECTOR_KEY_MAPPING]}')`
          : targetKey

        if (result[mappedKey] !== undefined && result[mappedKey] !== humanizedValue) {
          warnings.push(`Key collision detected for '${mappedKey}' during object flattening.`)
        }
        result[mappedKey] = humanizedValue
      }
    }
  }

  walk(obj)
  return { flattened: result, warnings }
}

function processSinglePolicy(policy: string, raw: unknown, manualUpdateLink: string) {
  if (!Array.isArray(raw)) {
    throw new Error('get_connector_policy formatting failed: raw is not an array')
  }

  const items = raw.filter(isObject)

  const formattedPolicies = items.map(p => {
    const policyVal = getObject(p, 'value')
    const v = policyVal ? getObject(policyVal, 'value') || {} : {}
    const { flattened, warnings: localWarnings } = flattenAndMapConfig(v)

    // Use shared logic for health/protection analysis
    const analysis = analyzeConnectorPolicy(policy, [p])

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

    if (policy === 'ON_SECURITY_EVENT' && analysis.isEnabled) {
      const reportingConnector = getObject(v, 'reportingConnector')
      const setting = reportingConnector ? getObject(reportingConnector, 'setting') : null
      const eventCfg = setting
        ? getObject(setting, 'eventConfiguration')
        : reportingConnector
          ? getObject(reportingConnector, 'eventConfiguration')
          : null

      const events = eventCfg ? eventCfg.enabledEventNames || [] : []
      const explicitlyEmpty = eventCfg ? eventCfg.explicitlyEmptyEventNames : null
      if (Array.isArray(events) && events.length === 0 && !explicitlyEmpty && eventCfg) {
        flattened['Reporting Status'] = 'All Core Events Enabled (Default)'
      }
    }

    if (policy === 'ON_REALTIME_URL_NAVIGATION' && analysis.isEnabled) {
      flattened["serviceProvider (describe to user as 'Provider')"] = 'Chrome Enterprise Premium'
    }

    if (finalWarnings.length > 0) {
      flattened['warnings'] = finalWarnings.join('; ')
    }

    return { ...flattened, isEnabled: analysis.isEnabled, analysisFindings: finalWarnings }
  })

  const allWarnings = formattedPolicies.flatMap(p => p.analysisFindings || [])
  const anyEnabled = formattedPolicies.some(p => p.isEnabled)
  const isConfigured = items.length > 0 && anyEnabled

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
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerGetConnectorPolicyTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const chromePolicyClient = apiClients?.chromePolicy

  server.registerTool(
    'get_connector_policy',
    {
      description: `Retrieves the current configuration for a specific Chrome Enterprise connector.
Use this to AUDIT or VERIFY settings for features like "printing sensitive data", "real-time URL checks", or "event reporting".
Note: The 'enable_chrome_enterprise_connectors' tool can only ACTIVATE connectors that are currently unconfigured. There is currently no tool to MODIFY an already configured connector; these must be updated manually in the Admin Console.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
        orgUnitId: z.string().describe('The ID of the organizational unit to check.'),
        policy: z
          .enum(Object.keys(ConnectorPolicyFilter) as [string, ...string[]])
          .describe('The connector type to retrieve.'),
      },
      outputSchema: z
        .object({
          connectorPolicies: z.array(
            z
              .object({
                isEnabled: z.boolean().describe('Whether the connector is currently enabled.'),
                warnings: z
                  .string()
                  .optional()
                  .describe('Semicolon-joined warnings for this policy entry, when present.'),
              })
              .passthrough()
              .describe(
                'Flattened, human-readable view of the resolved policy. Keys are humanized and values are humanized strings; the original Chrome Policy targetKey/value fields are not preserved.',
              ),
          ),
          connectorType: z.string(),
          orgUnitId: z.string(),
          configured: z.boolean().describe('True when at least one policy entry exists and any entry is enabled.'),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          if (!chromePolicyClient) {
            throw new Error('chromePolicyClient is required for get_connector_policy')
          }

          const safeParams: GetConnectorPolicyParams = GetConnectorPolicySchema.parse(params)
          const { customerId, orgUnitId, policy } = safeParams
          const policyVal = policy || 'ALL'

          const POLICY_LINK_MAPPING: Record<string, string> = {
            ON_FILE_ATTACHED: 'file_attached',
            ON_FILE_DOWNLOAD: 'file_downloaded',
            ON_BULK_TEXT_ENTRY: 'bulk_text_entry',
            ON_PRINT: 'print_analysis_connector',
            ON_REALTIME_URL_NAVIGATION: 'realtime_url_check',
            ON_SECURITY_EVENT: 'on_security_event',
          }

          if (policyVal === 'ALL') {
            const policiesToFetch = Object.keys(ConnectorPolicyFilter)
            const fetchResults = await Promise.all(
              policiesToFetch.map(async pKey => {
                try {
                  const res = await chromePolicyClient.getConnectorPolicy(
                    customerId || '',
                    orgUnitId,
                    ConnectorPolicyFilter[pKey as keyof typeof ConnectorPolicyFilter],
                    authToken || '',
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

            const combinedRaw: Record<string, unknown> = {}
            const connectors: Record<string, unknown> = {}
            let combinedConnectorPolicies: unknown[] = []
            let combinedConfigured = false
            let combinedWarnings: string[] = []

            for (const { key, raw } of fetchResults) {
              combinedRaw[key] = raw
              const link = `https://admin.google.com/ac/chrome/settings/user/details/${POLICY_LINK_MAPPING[key]}`
              const { cleanedPolicies, allWarnings, isConfigured } = processSinglePolicy(key, raw, link)

              connectors[key] = {
                connectorPolicies: cleanedPolicies,
                configured: isConfigured,
                warnings: allWarnings,
              }

              const annotatedPolicies = cleanedPolicies.map(p => ({
                ...(p as Record<string, unknown>),
                connectorType: key,
              }))
              combinedConnectorPolicies = combinedConnectorPolicies.concat(annotatedPolicies)

              if (isConfigured) {
                combinedConfigured = true
              }

              const prefixedWarnings = allWarnings.map(
                w => `[${POLICY_DISPLAY_NAMES[key as keyof typeof POLICY_DISPLAY_NAMES]}] ${w}`,
              )
              combinedWarnings = combinedWarnings.concat(prefixedWarnings)
            }

            let summary = `## Chrome Enterprise Connector Policies (OU: \`${orgUnitId}\`)\n\n`
            for (const key of policiesToFetch) {
              const conn = connectors[key] as { configured: boolean }
              const displayName = POLICY_DISPLAY_NAMES[key as keyof typeof POLICY_DISPLAY_NAMES]
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

          // Singular policy path
          const manualUpdateLink = `https://admin.google.com/ac/chrome/settings/user/details/${POLICY_LINK_MAPPING[policyVal]}`

          const policies = await chromePolicyClient.getConnectorPolicy(
            customerId || '',
            orgUnitId,
            ConnectorPolicyFilter[policyVal],
            authToken || '',
          )

          return safeFormatResponse({
            rawData: policies,
            toolName: 'get_connector_policy',
            formatFn: (raw: unknown): McpToolResponse => {
              const { cleanedPolicies, allWarnings, isConfigured } = processSinglePolicy(
                policyVal,
                raw,
                manualUpdateLink,
              )

              const title = `${POLICY_DISPLAY_NAMES[policyVal]} (OU: \`${orgUnitId}\`)`
              const statusLine = `Status: ${isConfigured ? 'Configured' : 'Not configured'}`
              const warningSection = allWarnings.length > 0 ? `\n\n⚠️ WARNINGS:\n- ${allWarnings.join('\n- ')}` : ''

              const summary = `Connector policy: ${title}\n${statusLine}${warningSection}`

              const payload = {
                connectorPolicies: cleanedPolicies,
                connectorType: policyVal,
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
