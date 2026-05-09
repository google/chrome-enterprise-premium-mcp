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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { TAGS, CONNECTOR_DISPLAY_NAMES } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { ConnectorPolicyFilter } from '../../lib/api/chrome_policy_client.js'
import { CHROME_ACTION_TYPES } from '../../lib/util/chrome_dlp_constants.js'
import { analyzeConnectorPolicy, PolicyFinding } from '../../lib/util/connector_policy_helper.js'
import { isObject, getString, getObject } from '../../lib/util/helpers.js'
import { AdminSdkClient } from '../../lib/api/admin_sdk_client.js'
import { ChromeManagementClient } from '../../lib/api/chrome_management_client.js'
import { ChromePolicyClient } from '../../lib/api/chrome_policy_client.js'
import { CloudIdentityClient } from '../../lib/api/cloud_identity_client.js'

const CONNECTOR_TYPES = {
  uploadAnalysis: 'ON_FILE_ATTACHED',
  downloadAnalysis: 'ON_FILE_DOWNLOAD',
  pasteAnalysis: 'ON_BULK_TEXT_ENTRY',
  printAnalysis: 'ON_PRINT',
  realtimeUrlCheck: 'ON_REALTIME_URL_NAVIGATION',
  securityEventReporting: 'ON_SECURITY_EVENT',
}

const SEB_EXTENSION_SCHEMA = 'chrome.users.apps.InstallType'
const SEB_EXTENSION_ID = 'chrome:ekajlcmdfcigmdbphhifahdfjbkciflj'
const DEFAULT_PAGE_SIZE = 50

interface DiagnosticIssue {
  severity: 'critical' | 'high' | 'medium' | (string & {})
  component: string
  message: string
}

interface ConnectorState {
  configured: boolean
  isEnabled: boolean
  policyCount: number
  findings: PolicyFinding[]
  error?: boolean
}

interface AggregatedEnvironment {
  customer: {
    customerId: string
    domain?: string
  }
  orgUnits: Array<{ name: string; orgUnitId: string; orgUnitPath: string }>
  subscription: {
    isActive: boolean
    assignmentCount: number
  }
  versions: Array<{ version: string; count: number; channel?: string }>
  allDlpRules: Array<{
    name: string
    displayName: string
    state: string
    actionType: string
    triggers: string[]
    orgUnit?: string
  }>
  allDetectors: Array<{
    name: string
    displayName: string
    type?: string
  }>
  connectors: Record<string, ConnectorState>
  sebExtension: {
    isInstalled: boolean
    error?: boolean
  }
}

interface DiagnosticSummaryData {
  customer: {
    customerId: string
    domain?: string
  }
  orgUnitCount: number
  subscription: {
    isActive: boolean
    assignmentCount: number
  }
  dlpRules: {
    total: number
    active: number
    inactive: number
    hasEnforcement: boolean
    byAction: {
      block: number
      warn: number
      audit: number
      watermark: number
    }
  }
  detectors: {
    total: number
  }
  connectors: Record<string, ConnectorState>
  sebExtension: {
    isInstalled: boolean
    error?: boolean
  }
  browserVersions: {
    total: number
    deviceCount: number
  }
  issues: DiagnosticIssue[]
}

/**
 * Computes deterministic issues from the environment summary.
 * @param data The aggregated environment counts and status flags
 * @returns A list of health issues with severity levels
 */
function computeIssues(data: DiagnosticSummaryData): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = []

  if (!data.subscription.isActive) {
    issues.push({
      severity: 'critical',
      component: 'subscription',
      message: 'No active Chrome Enterprise Premium subscription found.',
    })
  } else if (data.subscription.assignmentCount <= 1) {
    issues.push({
      severity: 'medium',
      component: 'subscription',
      message: `Only ${data.subscription.assignmentCount} CEP license(s) assigned. Verify all intended users have licenses.`,
    })
  }

  for (const [key, connector] of Object.entries(data.connectors)) {
    const name = CONNECTOR_DISPLAY_NAMES[key as keyof typeof CONNECTOR_DISPLAY_NAMES] || key
    if (!connector.configured) {
      issues.push({
        severity: 'critical',
        component: `connector.${key}`,
        message: `${name} connector is not configured.`,
      })
    } else if (!connector.isEnabled) {
      issues.push({
        severity: 'critical',
        component: `connector.${key}`,
        message: `${name} connector is present but explicitly disabled.`,
      })
    }

    if (connector.isEnabled && connector.findings && connector.findings.length > 0) {
      for (const finding of connector.findings) {
        issues.push({
          severity: 'high',
          component: `connector.${key}`,
          message: `${name}: ${finding.message}`,
        })
      }
    }
  }

  const dlpRules = data.dlpRules
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

  if (!data.sebExtension.isInstalled) {
    issues.push({
      severity: 'high',
      component: 'sebExtension',
      message: 'Secure Enterprise Browser (SEB) extension is not force-installed.',
    })
  }

  if (data.detectors.total === 0) {
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
 * @param action The chromeAction object
 * @returns One of: block, warn, audit, watermark, unknown
 */
function classifyAction(action: Record<string, unknown>): string {
  const foundAction = Object.values(CHROME_ACTION_TYPES).find(a => action[a.apiKey] !== undefined)
  if (foundAction) {
    return foundAction.value.toLowerCase()
  }
  if (action.watermarkContent !== undefined) {
    return 'watermark'
  }
  return 'unknown'
}

/**
 * Fetches all environment data and returns raw collections.
 */
async function fetchEnvironment(
  adminSdkClient: AdminSdkClient,
  chromeManagementClient: ChromeManagementClient,
  chromePolicyClient: ChromePolicyClient,
  cloudIdentityClient: CloudIdentityClient,
  customerId: string,
  authToken: string,
): Promise<AggregatedEnvironment> {
  const [customerData, orgUnitsData, subscriptionData, dlpPolicies, detectorPolicies, browserVersions] =
    await Promise.all([
      adminSdkClient.getCustomerId(authToken),
      adminSdkClient.listOrgUnits({ customerId }, authToken),
      adminSdkClient.checkCepSubscription(customerId, authToken),
      cloudIdentityClient.listDlpRules(authToken),
      cloudIdentityClient.listDetectors(authToken),
      chromeManagementClient.countBrowserVersions(customerId, undefined, authToken),
    ])

  const rawUnits = orgUnitsData?.organizationUnits || []
  const orgUnits = rawUnits.filter(isObject).map(ou => ({
    name: getString(ou, 'name') || '',
    orgUnitId: getString(ou, 'orgUnitId') || '',
    orgUnitPath: getString(ou, 'orgUnitPath') || '',
  }))

  const rootOU = orgUnits.find(ou => ou.orgUnitPath === '/') || orgUnits[0]
  const rootOUId = rootOU?.orgUnitId?.replace('id:', '') || null

  const customer = {
    customerId: customerData?.id || customerId || 'unknown',
    domain: customerData?.customerDomain || undefined,
  }

  const subItems = subscriptionData?.items || []
  const subscription = { isActive: subItems.length > 0, assignmentCount: subItems.length }

  const versions = (Array.isArray(browserVersions) ? browserVersions : []).filter(isObject).map(v => {
    const countStr = getString(v, 'count')
    return {
      version: getString(v, 'version') || '',
      count: countStr ? Number(countStr) : 0,
      channel: getString(v, 'channel') || undefined,
    }
  })

  const dlpPoliciesList = Array.isArray(dlpPolicies) ? dlpPolicies.filter(isObject) : []
  const allDlpRules = dlpPoliciesList
    .filter(p => {
      const setting = getObject(p, 'setting')
      return setting ? getString(setting, 'type') === 'settings/rule.dlp' : false
    })
    .map(p => {
      const setting = getObject(p, 'setting')
      const val = setting ? getObject(setting, 'value') || {} : {}
      const action = getObject(val, 'action')
      const chromeAction = action ? getObject(action, 'chromeAction') || {} : {}
      const policyQuery = getObject(p, 'policyQuery')

      return {
        name: getString(p, 'name') || '',
        displayName: getString(val, 'displayName') || getString(p, 'name') || '',
        state: getString(val, 'state') || 'UNKNOWN',
        actionType: classifyAction(chromeAction),
        triggers: (val.triggers as string[]) || [],
        orgUnit: policyQuery ? getString(policyQuery, 'orgUnit') || undefined : undefined,
      }
    })

  const detectorPoliciesList = Array.isArray(detectorPolicies) ? detectorPolicies.filter(isObject) : []
  const allDetectors = detectorPoliciesList
    .filter(p => {
      const setting = getObject(p, 'setting')
      const typeStr = setting ? getString(setting, 'type') : null
      return typeStr ? typeStr.startsWith('settings/detector') : false
    })
    .map(p => {
      const setting = getObject(p, 'setting')
      const val = setting ? getObject(setting, 'value') || {} : {}
      return {
        name: getString(p, 'name') || '',
        displayName: getString(val, 'displayName') || getString(p, 'name') || '',
        type: setting ? getString(setting, 'type') || undefined : undefined,
      }
    })

  const connectors: Record<string, ConnectorState> = {}
  if (rootOUId && chromePolicyClient) {
    const connectorResults = await Promise.all(
      Object.entries(CONNECTOR_TYPES).map(async ([key, policyKey]) => {
        try {
          const schema = ConnectorPolicyFilter[policyKey as keyof typeof ConnectorPolicyFilter]
          const policies = await chromePolicyClient.getConnectorPolicy(customerId, rootOUId, schema, authToken)
          const analysis = analyzeConnectorPolicy(policyKey, policies)
          return [
            key,
            {
              configured: analysis.isConfigured,
              isEnabled: analysis.isEnabled,
              policyCount: policies.length,
              findings: analysis.findings,
            },
          ]
        } catch {
          return [
            key,
            { configured: false, isEnabled: false, policyCount: 0, findings: [] as PolicyFinding[], error: true },
          ]
        }
      }),
    )
    for (const entry of connectorResults) {
      const k = entry[0] as string
      const val = entry[1] as ConnectorState
      connectors[k] = val
    }
  }

  let sebExtension: { isInstalled: boolean; error?: boolean } = { isInstalled: false }
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

const DiagnoseEnvironmentSchema = z.object({
  customerId: z.string().optional(),
  section: z.enum(['orgUnits', 'dlpRules', 'detectors', 'browserVersions']).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
})

type DiagnoseEnvironmentParams = z.infer<typeof DiagnoseEnvironmentSchema>

/**
 * Registers the 'diagnose_environment' tool with the MCP server.
 * @param server The MCP server instance
 * @param options Must include all API clients
 * @param sessionState State object for the current session
 */
export function registerDiagnoseEnvironmentTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const adminSdkClient = apiClients?.adminSdk
  const chromeManagementClient = apiClients?.chromeManagement
  const chromePolicyClient = apiClients?.chromePolicy
  const cloudIdentityClient = apiClients?.cloudIdentity

  server.registerTool(
    'diagnose_environment',
    {
      description: `Runs a health check of the Chrome Enterprise Premium environment.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID. Auto-resolved if omitted.'),
        section: z
          .enum(['orgUnits', 'dlpRules', 'detectors', 'browserVersions'])
          .optional()
          .describe('Drill into a specific section with paginated results. Omit for summary.'),
        limit: z.number().int().min(1).max(200).optional().describe('Page size for detail sections (default 50).'),
        offset: z.number().int().min(0).optional().describe('Pagination offset for detail sections (default 0).'),
      },
      outputSchema: z.object({}).passthrough(),
    },
    guardedToolCall(
      {
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          if (!adminSdkClient || !chromeManagementClient || !chromePolicyClient || !cloudIdentityClient) {
            throw new Error('All API clients are required for diagnose_environment')
          }

          // Strictly parse using Zod
          const safeParams: DiagnoseEnvironmentParams = DiagnoseEnvironmentSchema.parse(params)
          const { customerId, section, limit, offset } = safeParams

          logger.info(`${TAGS.MCP} diagnose_environment: starting (section=${section || 'summary'})`)

          const env = await fetchEnvironment(
            adminSdkClient,
            chromeManagementClient,
            chromePolicyClient,
            cloudIdentityClient,
            customerId || '',
            authToken || '',
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
 */
function buildSummaryResponse(env: AggregatedEnvironment): McpToolResponse {
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

  const sc: DiagnosticSummaryData = {
    customer,
    orgUnitCount: orgUnits.length,
    subscription,
    dlpRules: dlpRuleSummary,
    detectors: { total: allDetectors.length },
    connectors,
    sebExtension,
    browserVersions: { total: versions.length, deviceCount: totalDevices },
    issues: [] as DiagnosticIssue[],
  }
  sc.issues = computeIssues(sc)

  const issueCount = sc.issues.length
  const critical = sc.issues.filter(i => i.severity === 'critical').length
  const high = sc.issues.filter(i => i.severity === 'high').length
  const medium = sc.issues.filter(i => i.severity === 'medium').length

  let summary = `## Environment Health Check\n\n`
  summary += `> **Scope:** Health check is scoped to the Root Organizational Unit (/). Sub-OU overrides are not included in this summary.\n\n`
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
 */
function buildDetailResponse(
  env: AggregatedEnvironment,
  section: string,
  limit: number,
  offset: number,
): McpToolResponse {
  let allItems: Array<Record<string, unknown>> = []
  let summary = ''

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
  }

  const total = allItems.length
  const items = allItems.slice(offset, offset + limit)

  if (items.length === 0) {
    summary = `## ${section} — no items (offset ${offset} of ${total} total)`
  } else {
    const rangeStart = offset + 1
    const rangeEnd = offset + items.length
    summary = `## ${section} (${rangeStart}–${rangeEnd} of ${total})\n\n`

    switch (section) {
      case 'orgUnits':
        summary += items
          .map(
            (ou, i) =>
              `${offset + i + 1}. **${getString(ou, 'name') || ''}** — \`${getString(ou, 'orgUnitPath') || ''}\``,
          )
          .join('\n')
        break
      case 'dlpRules':
        summary += items
          .map(
            (r, i) =>
              `${offset + i + 1}. **${getString(r, 'displayName') || ''}** — ${getString(r, 'state') || ''}, action: ${getString(r, 'actionType') || ''}`,
          )
          .join('\n')
        break
      case 'detectors':
        summary += items
          .map((d, i) => {
            const rawType = getString(d, 'type')
            const typeName = rawType ? rawType.split('.').pop() || 'unknown' : 'unknown'
            return `${offset + i + 1}. **${getString(d, 'displayName') || ''}** (${typeName})`
          })
          .join('\n')
        break
      case 'browserVersions':
        summary += items
          .map(v => {
            const countVal = v.count
            const countNum = typeof countVal === 'number' ? countVal : 0
            return `- **${getString(v, 'version') || ''}** (${getString(v, 'channel') || 'UNKNOWN'}): ${countNum} devices`
          })
          .join('\n')
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
