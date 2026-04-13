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
 * @file Aggregated environment diagnostic tool.
 *
 * Two modes:
 * - Summary (default): counts, issues, top-level stats. No large arrays.
 * - Detail (section=X): paginated data for a specific area.
 *
 * This keeps the default response small even for 100K+ license orgs.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

const CONNECTOR_TYPES = {
  uploadAnalysis: 'chrome.users.OnFileAttachedConnectorPolicy',
  downloadAnalysis: 'chrome.users.OnFileDownloadedConnectorPolicy',
  pasteAnalysis: 'chrome.users.OnBulkTextEntryConnectorPolicy',
  printAnalysis: 'chrome.users.OnPrintAnalysisConnectorPolicy',
  realtimeUrlCheck: 'chrome.users.RealtimeUrlCheck',
  securityEventReporting: 'chrome.users.OnSecurityEvent',
}

const CONNECTOR_DISPLAY_NAMES = {
  uploadAnalysis: 'Upload content analysis',
  downloadAnalysis: 'File download analysis',
  pasteAnalysis: 'Paste/bulk text analysis',
  printAnalysis: 'Print analysis',
  realtimeUrlCheck: 'Real-time URL check',
  securityEventReporting: 'Security event reporting',
}

const SEB_EXTENSION_SCHEMA = 'chrome.users.apps.InstallType'
const SEB_EXTENSION_ID = 'chrome:ekajlcmdfcigmdbphhifahdfjbkciflj'
const DEFAULT_PAGE_SIZE = 50

/**
 * Computes deterministic issues from the environment summary.
 * Validates subscription status, connector configurations, DLP rule enforcement,
 * and force-installation of required extensions.
 * @param {object} data - The aggregated environment counts and status flags
 * @returns {Array<{severity: string, component: string, message: string}>} A list of health issues with severity levels
 */
function computeIssues(data) {
  const issues = []

  if (!data.subscription?.isActive) {
    issues.push({
      severity: 'critical',
      component: 'subscription',
      message: 'No active Chrome Enterprise Premium subscription found.',
    })
  } else if (data.subscription?.assignmentCount <= 1) {
    issues.push({
      severity: 'medium',
      component: 'subscription',
      message: `Only ${data.subscription.assignmentCount} CEP license(s) assigned. Verify all intended users have licenses.`,
    })
  }

  for (const [key, connector] of Object.entries(data.connectors || {})) {
    if (!connector.configured) {
      const name = CONNECTOR_DISPLAY_NAMES[key] || key
      issues.push({
        severity: 'critical',
        component: `connector.${key}`,
        message: `${name} connector is not configured.`,
      })
    }
  }

  const dlpRules = data.dlpRules || { total: 0, active: 0, inactive: 0, hasEnforcement: false }
  if (dlpRules.total === 0) {
    issues.push({
      severity: 'high',
      component: 'dlpRules',
      message: 'No DLP rules configured.',
    })
  } else {
    if (dlpRules.active === 0) {
      issues.push({
        severity: 'high',
        component: 'dlpRules',
        message: 'All DLP rules are inactive.',
      })
    } else if (dlpRules.inactive > 0) {
      issues.push({
        severity: 'medium',
        component: 'dlpRules',
        message: `${dlpRules.inactive} DLP rule(s) are inactive.`,
      })
    }
    if (dlpRules.active > 0 && !dlpRules.hasEnforcement) {
      issues.push({
        severity: 'medium',
        component: 'dlpRules',
        message: 'All active DLP rules are audit-only. No blocking or warning enforcement.',
      })
    }
  }

  if (!data.sebExtension?.isInstalled) {
    issues.push({
      severity: 'high',
      component: 'sebExtension',
      message: 'Secure Enterprise Browser (SEB) extension is not force-installed.',
    })
  }

  if (data.detectors?.total === 0) {
    issues.push({
      severity: 'medium',
      component: 'detectors',
      message: 'No custom content detectors configured.',
    })
  }

  return issues
}

/**
 * Classifies the action type from a DLP rule's chromeAction field.
 * @param {object} action - The chromeAction object
 * @returns {string} One of: block, warn, audit, watermark, unknown
 */
function classifyAction(action) {
  if (action.blockContent !== undefined) {
    return 'block'
  }
  if (action.warnUser !== undefined) {
    return 'warn'
  }
  if (action.auditOnly !== undefined) {
    return 'audit'
  }
  if (action.watermarkContent !== undefined) {
    return 'watermark'
  }
  return 'unknown'
}

/**
 * Fetches all environment data and returns raw collections for
 * both summary computation and detail pagination.
 * @param {import('../../lib/api/interfaces/admin_sdk_client.js').AdminSdkClient} adminSdkClient - Client for customer, org unit, and license data
 * @param {import('../../lib/api/interfaces/chrome_management_client.js').ChromeManagementClient} chromeManagementClient - Client for browser and device telemetry
 * @param {import('../../lib/api/interfaces/chrome_policy_client.js').ChromePolicyClient} chromePolicyClient - Client for verifying connector and extension policies
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} cloudIdentityClient - Client for listing DLP rules and detectors
 * @param {string} customerId - The Chrome customer ID used for scoping requests
 * @param {string} authToken - The Bearer token for authorized API access
 * @returns {Promise<object>} A consolidated object containing raw data from all services
 */
async function fetchEnvironment(
  adminSdkClient,
  chromeManagementClient,
  chromePolicyClient,
  cloudIdentityClient,
  customerId,
  authToken,
) {
  const [customerData, orgUnitsData, subscriptionData, dlpPolicies, detectorPolicies, browserVersions] =
    await Promise.all([
      adminSdkClient.getCustomerId(authToken).catch(e => ({ error: e.message })),
      adminSdkClient.listOrgUnits({ customerId }, authToken).catch(e => ({ error: e.message })),
      adminSdkClient.checkCepSubscription(customerId, authToken).catch(e => ({ error: e.message })),
      cloudIdentityClient.listDlpRules(authToken).catch(() => []),
      cloudIdentityClient.listDetectors(authToken).catch(() => []),
      chromeManagementClient.countBrowserVersions(customerId, null, authToken).catch(() => []),
    ])

  const orgUnits = orgUnitsData?.organizationUnits || []
  const rootOU = orgUnits.find(ou => ou.orgUnitPath === '/') || orgUnits[0]
  const rootOUId = rootOU?.orgUnitId?.replace('id:', '') || null

  const customer = {
    customerId: customerData?.id || customerId || 'unknown',
    domain: customerData?.customerDomain,
  }

  const subItems = subscriptionData?.items || []
  const subscription = { isActive: subItems.length > 0, assignmentCount: subItems.length }

  const versions = (Array.isArray(browserVersions) ? browserVersions : []).map(v => ({
    version: v.version,
    count: Number(v.count) || 0,
    channel: v.channel,
  }))

  const allDlpRules = dlpPolicies
    .filter(p => p.setting?.type === 'settings/rule.dlp')
    .map(p => {
      const val = p.setting?.value || {}
      const action = val.action?.chromeAction || {}
      return {
        name: p.name,
        displayName: val.displayName || p.name,
        state: val.state || 'UNKNOWN',
        actionType: classifyAction(action),
        triggers: val.triggers || [],
        orgUnit: p.policyQuery?.orgUnit,
      }
    })

  const allDetectors = detectorPolicies
    .filter(p => p.setting?.type?.startsWith('settings/detector'))
    .map(p => ({
      name: p.name,
      displayName: p.setting?.value?.displayName || p.name,
      type: p.setting?.type,
    }))

  // Connector checks on root OU (parallel)
  const connectors = {}
  if (rootOUId && chromePolicyClient) {
    const connectorResults = await Promise.all(
      Object.entries(CONNECTOR_TYPES).map(async ([key, schema]) => {
        try {
          const policies = await chromePolicyClient.getConnectorPolicy(customerId, rootOUId, schema, authToken)
          return [key, { configured: policies.length > 0, policyCount: policies.length }]
        } catch {
          return [key, { configured: false, policyCount: 0, error: true }]
        }
      }),
    )
    for (const [key, val] of connectorResults) {
      connectors[key] = val
    }
  }

  // SEB extension on root OU
  let sebExtension = { isInstalled: false }
  if (rootOUId && chromePolicyClient) {
    try {
      const sebPolicies = await chromePolicyClient.resolvePolicy(customerId, rootOUId, SEB_EXTENSION_SCHEMA, authToken)
      const sebEntry = sebPolicies.find(p => p.targetKey?.additionalTargetKeys?.app_id === SEB_EXTENSION_ID)
      sebExtension = { isInstalled: sebEntry?.value?.value?.appInstallType === 'FORCED' }
    } catch {
      sebExtension = { isInstalled: false, error: true }
    }
  }

  return { customer, orgUnits, subscription, versions, allDlpRules, allDetectors, connectors, sebExtension }
}

/**
 * Registers the 'diagnose_environment' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 * @param {object} options - Must include all API clients
 * @param {object} sessionState - State object for the current session
 */
export function registerDiagnoseEnvironmentTool(server, options, sessionState) {
  const { adminSdkClient, chromeManagementClient, chromePolicyClient, cloudIdentityClient } = options

  server.registerTool(
    'diagnose_environment',
    {
      description: `Runs a health check of the Chrome Enterprise Premium environment.

By default returns a **summary** with counts and pre-computed issues — no large arrays. The agent should present these findings to the user.

To drill into detail, pass a 'section' parameter:
- "orgUnits" — paginated list of organizational units
- "dlpRules" — paginated list of DLP rules with action types
- "detectors" — paginated list of content detectors
- "browserVersions" — all browser version counts

Use 'limit' and 'offset' for pagination on large datasets.`,
      inputSchema: z.object({
        customerId: z.string().optional().describe('The Chrome customer ID. Auto-resolved if omitted.'),
        section: z
          .enum(['orgUnits', 'dlpRules', 'detectors', 'browserVersions'])
          .optional()
          .describe('Drill into a specific section with paginated results. Omit for summary.'),
        limit: z.number().int().min(1).max(200).optional().describe('Page size for detail sections (default 50).'),
        offset: z.number().int().min(0).optional().describe('Pagination offset for detail sections (default 0).'),
      }),
      outputSchema: z.object({}).passthrough(),
    },
    guardedToolCall(
      {
        handler: async ({ customerId, section, limit, offset }, { _requestInfo, authToken }) => {
          logger.info(`${TAGS.MCP} diagnose_environment: starting (section=${section || 'summary'})`)

          const env = await fetchEnvironment(
            adminSdkClient,
            chromeManagementClient,
            chromePolicyClient,
            cloudIdentityClient,
            customerId,
            authToken,
          )

          // Detail mode: return paginated section data
          if (section) {
            const pageSize = limit || DEFAULT_PAGE_SIZE
            const pageOffset = offset || 0
            return buildDetailResponse(env, section, pageSize, pageOffset)
          }

          // Summary mode: counts + issues, no large arrays
          return buildSummaryResponse(env)
        },
      },
      options,
      sessionState,
    ),
  )
}

/**
 * Builds the high-level health summary response.
 * Aggregates counts for DLP rules, detectors, and devices while highlighting
 * critical issues discovered during the diagnostic run.
 * @param {object} env - The consolidated environment data
 * @returns {object} The formatted tool response for the agent to present to the user
 */
function buildSummaryResponse(env) {
  const { customer, orgUnits, subscription, versions, allDlpRules, allDetectors, connectors, sebExtension } = env

  const activeRules = allDlpRules.filter(r => r.state === 'ACTIVE')
  const inactiveRules = allDlpRules.filter(r => r.state !== 'ACTIVE')
  const hasEnforcement = activeRules.some(r => r.actionType === 'block' || r.actionType === 'warn')
  const totalDevices = versions.reduce((s, v) => s + v.count, 0)

  const dlpRuleSummary = {
    total: allDlpRules.length,
    active: activeRules.length,
    inactive: inactiveRules.length,
    hasEnforcement,
    byAction: {
      block: activeRules.filter(r => r.actionType === 'block').length,
      warn: activeRules.filter(r => r.actionType === 'warn').length,
      audit: activeRules.filter(r => r.actionType === 'audit').length,
      watermark: activeRules.filter(r => r.actionType === 'watermark').length,
    },
  }

  const sc = {
    customer,
    orgUnitCount: orgUnits.length,
    subscription,
    dlpRules: dlpRuleSummary,
    detectors: { total: allDetectors.length },
    connectors,
    sebExtension,
    browserVersions: { total: versions.length, deviceCount: totalDevices },
    issues: [],
  }
  sc.issues = computeIssues(sc)

  const issueCount = sc.issues.length
  const critical = sc.issues.filter(i => i.severity === 'critical').length
  const high = sc.issues.filter(i => i.severity === 'high').length
  const medium = sc.issues.filter(i => i.severity === 'medium').length

  let summary = `## Environment Health Check\n\n`
  summary += `**Customer:** ${customer.customerId} (${customer.domain || 'unknown domain'})\n`
  summary += `**Org Units:** ${orgUnits.length}\n`
  summary += `**CEP Subscription:** ${subscription.isActive ? `Active (${subscription.assignmentCount} licenses)` : 'Not active'}\n`
  summary += `**DLP Rules:** ${allDlpRules.length} total (${activeRules.length} active: ${dlpRuleSummary.byAction.block} block, ${dlpRuleSummary.byAction.warn} warn, ${dlpRuleSummary.byAction.audit} audit, ${dlpRuleSummary.byAction.watermark} watermark)\n`
  summary += `**Detectors:** ${allDetectors.length}\n`
  summary += `**Browser Versions:** ${versions.length} versions across ${totalDevices} devices\n`
  summary += `**SEB Extension:** ${sebExtension.isInstalled ? 'Force-installed' : 'Not installed'}\n\n`

  if (issueCount === 0) {
    summary += `**Result: No issues found.** The environment appears healthy.\n`
  } else {
    summary += `**Result: ${issueCount} issue(s) found** (${critical} critical, ${high} high, ${medium} medium)\n\n`
    for (const issue of sc.issues) {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟠' : '🟡'
      summary += `${icon} **${issue.severity.toUpperCase()}** (${issue.component}): ${issue.message}\n`
    }
  }

  summary += `\nTo drill into details, call diagnose_environment again with section="orgUnits", "dlpRules", "detectors", or "browserVersions".`

  logger.info(`${TAGS.MCP} diagnose_environment: summary complete (${issueCount} issues)`)

  return formatToolResponse({ summary, data: sc, structuredContent: sc })
}

/**
 * Builds a paginated detail response for a specific diagnostic section.
 * Filters and slices the raw environment data based on the requested section,
 * limit, and offset to support interactive exploration of large datasets.
 * @param {object} env - The consolidated environment data
 * @param {string} section - The specific section to drill into (e.g., 'dlpRules')
 * @param {number} limit - Maximum number of items to return in this page
 * @param {number} offset - Starting index for pagination
 * @returns {object} The formatted tool response containing the requested subset of data
 */
function buildDetailResponse(env, section, limit, offset) {
  let allItems, items, total, summary

  switch (section) {
    case 'orgUnits':
      allItems = env.orgUnits.map(ou => ({ name: ou.name, orgUnitId: ou.orgUnitId, orgUnitPath: ou.orgUnitPath }))
      break
    case 'dlpRules':
      allItems = env.allDlpRules
      break
    case 'detectors':
      allItems = env.allDetectors
      break
    case 'browserVersions':
      allItems = env.versions
      break
    default:
      allItems = []
  }

  total = allItems.length
  items = allItems.slice(offset, offset + limit)

  if (items.length === 0) {
    summary = `## ${section} — no items (offset ${offset} of ${total} total)`
  } else {
    const rangeStart = offset + 1
    const rangeEnd = offset + items.length
    summary = `## ${section} (${rangeStart}–${rangeEnd} of ${total})\n\n`

    switch (section) {
      case 'orgUnits':
        summary += items.map((ou, i) => `${offset + i + 1}. **${ou.name}** — \`${ou.orgUnitPath}\``).join('\n')
        break
      case 'dlpRules':
        summary += items
          .map((r, i) => `${offset + i + 1}. **${r.displayName}** — ${r.state}, action: ${r.actionType}`)
          .join('\n')
        break
      case 'detectors':
        summary += items
          .map((d, i) => `${offset + i + 1}. **${d.displayName}** (${d.type?.split('.').pop() || 'unknown'})`)
          .join('\n')
        break
      case 'browserVersions':
        summary += items.map(v => `- **${v.version}** (${v.channel || 'UNKNOWN'}): ${v.count} devices`).join('\n')
        break
    }
  }

  const sc = {
    section,
    items,
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
  }

  logger.info(`${TAGS.MCP} diagnose_environment: detail ${section} (${items.length} of ${total})`)

  return formatToolResponse({ summary, data: sc, structuredContent: sc })
}
