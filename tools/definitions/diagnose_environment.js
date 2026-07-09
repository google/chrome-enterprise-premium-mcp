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
import { TAGS, CONNECTOR_DISPLAY_NAMES } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { ConnectorPolicyFilter } from '../../lib/api/chrome_policy_client.js'
import { CHROME_ACTION_TYPES } from '../../lib/util/chrome_dlp_constants.js'
import { analyzeConnectorPolicy } from '../../lib/util/connector_policy_helper.js'
import { FLAGS, featureFlags as defaultFeatureFlags } from '../../lib/util/feature_flags.js'

const CONNECTOR_TYPES = {
  uploadAnalysis: 'ON_FILE_ATTACHED',
  downloadAnalysis: 'ON_FILE_DOWNLOAD',
  pasteAnalysis: 'ON_BULK_TEXT_ENTRY',
  printAnalysis: 'ON_PRINT',
  realtimeUrlCheck: 'ON_REALTIME_URL_NAVIGATION',
  securityEventReporting: 'ON_SECURITY_EVENT',
}

const CONNECTOR_LINK_MAPPING = {
  uploadAnalysis: 'file_attached',
  downloadAnalysis: 'file_downloaded',
  pasteAnalysis: 'bulk_text_entry',
  printAnalysis: 'print_analysis_connector',
  realtimeUrlCheck: 'realtime_url_check',
  securityEventReporting: 'on_security_event',
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
      message: 'No active Chrome Enterprise Premium subscription found on this domain.',
    })
  } else if (data.subscription?.assignmentCount === 0) {
    issues.push({
      severity: 'warning',
      component: 'subscription',
      message:
        'Chrome Enterprise Premium subscription is active, but 0 users have licenses assigned. You must assign licenses to users.',
    })
  } else if (data.subscription?.assignmentCount === 1) {
    issues.push({
      severity: 'medium',
      component: 'subscription',
      message: `Only ${data.subscription.assignmentCount} CEP license(s) assigned. Verify all intended users have licenses.`,
    })
  }

  if (data.securityInsights?.insightsState === 'INSIGHTS_DISABLED') {
    issues.push({
      severity: 'critical',
      component: 'securityInsights',
      message:
        'Chrome Security Insights is disabled. Threat events, file scanning, and security telemetry reporting are inactive.',
    })
  } else if (data.securityInsights?.insightsState === 'INSIGHTS_ENABLEMENT_STATE_UNSPECIFIED') {
    issues.push({
      severity: 'medium',
      component: 'securityInsights',
      message: 'Chrome Security Insights status is unspecified or could not be retrieved.',
    })
  }

  if (data.securityInsights?.insightsState === 'INSIGHTS_ENABLED') {
    if (data.contentTransfers?.error) {
      issues.push({
        severity: 'medium',
        component: 'securityInsightsData',
        message: `Failed to query Content Transfers data: ${data.contentTransfers.message}`,
      })
    }
    if (data.urlVisits?.error) {
      issues.push({
        severity: 'medium',
        component: 'securityInsightsData',
        message: `Failed to query URL Visits data: ${data.urlVisits.message}`,
      })
    }
  }

  for (const [key, connector] of Object.entries(data.connectors || {})) {
    if (!Object.prototype.hasOwnProperty.call(CONNECTOR_DISPLAY_NAMES, key)) {
      continue
    }
    const name = CONNECTOR_DISPLAY_NAMES[key]
    const page = CONNECTOR_LINK_MAPPING[key]
    const manualLink = page ? `https://admin.google.com/ac/chrome/settings/user/details/${page}` : null
    const actionSuffix = manualLink ? `. Update settings manually at ${manualLink}` : ''

    if (!connector.configured) {
      issues.push({
        severity: 'critical',
        component: `connector.${key}`,
        message: `${name} connector is not configured.${actionSuffix}`,
        ...(manualLink && {
          remediation: {
            actionLabel: `Configure ${name} connector`,
            url: manualLink,
          },
        }),
      })
    } else if (!connector.isEnabled) {
      issues.push({
        severity: 'critical',
        component: `connector.${key}`,
        message: `${name} connector is present but explicitly disabled.${actionSuffix}`,
        ...(manualLink && {
          remediation: {
            actionLabel: `Enable ${name} connector`,
            url: manualLink,
          },
        }),
      })
    }

    if (connector.isEnabled && connector.findings && connector.findings.length > 0) {
      for (const finding of connector.findings) {
        issues.push({
          severity: 'high',
          component: `connector.${key}`,
          message: `${name}: ${finding.message}${actionSuffix}`,
          ...(manualLink && {
            remediation: {
              actionLabel: `Configure ${name} settings`,
              url: manualLink,
            },
          }),
        })
      }
    }
  }

  const dlpRules = data.dlpRules || { total: 0, active: 0, inactive: 0, hasEnforcement: false }
  if (dlpRules.total === 0) {
    issues.push({
      severity: 'high',
      component: 'dlpRules',
      message: 'No DLP rules configured. Create rules at: https://admin.google.com/ac/dp/rules',
      remediation: {
        actionLabel: 'Create DLP rules',
        url: 'https://admin.google.com/ac/dp/rules',
      },
    })
  } else {
    if (dlpRules.active === 0) {
      issues.push({
        severity: 'high',
        component: 'dlpRules',
        message: 'All DLP rules are inactive. Manage rules at: https://admin.google.com/ac/dp/rules',
        remediation: {
          actionLabel: 'Activate DLP rules',
          url: 'https://admin.google.com/ac/dp/rules',
        },
      })
    } else if (dlpRules.inactive > 0) {
      issues.push({
        severity: 'medium',
        component: 'dlpRules',
        message: `${dlpRules.inactive} DLP rule(s) are inactive. Manage rules at: https://admin.google.com/ac/dp/rules`,
        remediation: {
          actionLabel: 'Manage DLP rules',
          url: 'https://admin.google.com/ac/dp/rules',
        },
      })
    }
    if (dlpRules.active > 0 && !dlpRules.hasEnforcement) {
      issues.push({
        severity: 'medium',
        component: 'dlpRules',
        message:
          'All active DLP rules are audit-only. No blocking or warning enforcement. Manage rules at: https://admin.google.com/ac/dp/rules',
        remediation: {
          actionLabel: 'Configure blocking rules',
          url: 'https://admin.google.com/ac/dp/rules',
        },
      })
    }
  }

  if (!data.sebExtension?.isInstalled) {
    issues.push({
      severity: 'high',
      component: 'sebExtension',
      message:
        'Secure Enterprise Browser (SEB) extension is not force-installed. Configure it manually at https://admin.google.com/ac/chrome/apps/user',
      remediation: {
        actionLabel: 'Configure SEB force-installation',
        url: 'https://admin.google.com/ac/chrome/apps/user',
      },
    })
  }

  if (data.detectors?.total === 0) {
    issues.push({
      severity: 'medium',
      component: 'detectors',
      message: 'No custom content detectors configured.',
    })
  }

  if (data.secureGateway) {
    if (data.secureGateway.skipped) {
      issues.push({
        severity: 'info',
        component: 'secureGateway',
        message:
          'Secure Gateway health check was skipped because no GCP projectId was provided. Pass a `projectId` parameter to diagnose Secure Gateways, application routing, and IAM permissions.',
      })
    } else if (data.secureGateway.error) {
      issues.push({
        severity: 'medium',
        component: 'secureGateway',
        message: `Failed to query Secure Gateways for project ${data.secureGateway.projectId}: ${data.secureGateway.error}`,
      })
    } else {
      if (data.secureGateway.gateways.length === 0) {
        issues.push({
          severity: 'medium',
          component: 'secureGateway',
          message: `No Secure Gateways found in project ${data.secureGateway.projectId}.`,
        })
      } else {
        for (const gateway of data.secureGateway.gateways) {
          const state = gateway.state || 'STATE_UNSPECIFIED'
          if (state !== 'RUNNING') {
            const isCritical = state === 'ERROR'
            const isHigh = state === 'DOWN'
            const isMedium = ['CREATING', 'UPDATING', 'DELETING'].includes(state)
            const severity = isCritical ? 'critical' : isHigh ? 'high' : isMedium ? 'medium' : 'high'

            issues.push({
              severity,
              component: 'secureGateway',
              message: `Secure Gateway ${gateway.displayName || gateway.name} is in ${state} state.`,
            })
          }
          if (!gateway.serviceDiscovery) {
            issues.push({
              severity: 'medium',
              component: 'secureGateway',
              message: `Secure Gateway ${gateway.displayName || gateway.name} does not have Service Discovery enabled.`,
            })
          }
          if (gateway.applications && gateway.applications.length === 0) {
            issues.push({
              severity: 'medium',
              component: 'secureGateway',
              message: `Secure Gateway ${gateway.displayName || gateway.name} has no application routing configured.`,
            })
          }
          if (gateway.applications && gateway.applications.length > 0) {
            for (const app of gateway.applications) {
              const matchers = app.endpointMatchers || app.endpoint_matchers || []
              for (const matcher of matchers) {
                const ports = matcher.ports || []
                if (ports.includes(80)) {
                  issues.push({
                    severity: 'medium',
                    component: 'secureGateway.application',
                    message: `Application ${app.displayName || app.name} on gateway ${gateway.displayName || gateway.name} routes port 80. If accessed over unencrypted HTTP (http://), Chrome and SEB extension send direct GET requests instead of establishing a CONNECT tunnel, resulting in 401 Unauthorized errors. Ensure traffic is served over HTTPS.`,
                  })
                }
              }
            }

            const hasPrivateWebApps = gateway.applications.some(app => {
              const upstreams = app.upstreams || []
              return upstreams.some(u => Boolean(u.network))
            })

            const saEmail = gateway.delegatingServiceAccount || gateway.delegating_service_account
            if (hasPrivateWebApps) {
              if (!saEmail) {
                issues.push({
                  severity: 'high',
                  component: 'secureGateway.iam',
                  message: `Secure Gateway ${gateway.displayName || gateway.name} has private web applications configured, but no delegating service account is specified on the gateway. Private application routing into VPC upstreams will fail.`,
                })
              } else if (data.secureGateway.projectIamPolicy) {
                const bindings = data.secureGateway.projectIamPolicy.bindings || []
                const formattedMember = saEmail.startsWith('serviceAccount:') ? saEmail : `serviceAccount:${saEmail}`

                const hasUpstreamRole = bindings.some(b => {
                  if (b.role !== 'roles/beyondcorp.upstreamAccess' && b.role !== 'roles/beyondcorp.serviceAgent') {
                    return false
                  }
                  const members = b.members || []
                  return members.includes(formattedMember) || members.includes(saEmail)
                })

                if (!hasUpstreamRole) {
                  issues.push({
                    severity: 'high',
                    component: 'secureGateway.iam',
                    message: `Delegating service account (${saEmail}) on gateway ${gateway.displayName || gateway.name} is not directly granted 'roles/beyondcorp.upstreamAccess' on project ${data.secureGateway.projectId}. If permission is not inherited from a parent Folder or Organization, private web application routing into VPC upstreams will fail.`,
                    remediation: {
                      actionLabel: 'Verify or Grant GCP IAM Roles',
                      url: `https://console.cloud.google.com/iam-admin/iam?project=${data.secureGateway.projectId}`,
                    },
                  })
                }
              }
            }
          }
          if (data.secureGateway.projectIamPolicyError) {
            issues.push({
              severity: 'medium',
              component: 'secureGateway.iam',
              message: `Unable to automatically verify delegating service account permissions on project ${data.secureGateway.projectId} (${data.secureGateway.projectIamPolicyError}). Please manually verify that the delegating service account has 'roles/beyondcorp.upstreamAccess'.`,
              remediation: {
                actionLabel: 'Verify GCP IAM Roles Manually',
                url: `https://console.cloud.google.com/iam-admin/iam?project=${data.secureGateway.projectId}`,
              },
            })
          }
          if (gateway.applicationsError) {
            issues.push({
              severity: 'medium',
              component: 'secureGateway',
              message: `Failed to list applications for Secure Gateway ${gateway.displayName || gateway.name}: ${gateway.applicationsError}`,
            })
          }
        }
      }
    }
  }

  const SEVERITY_ORDER = {
    critical: 0,
    high: 1,
    medium: 2,
    warning: 3,
    info: 4,
  }

  return issues.sort((a, b) => {
    return (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
  })
}

/**
 * Classifies the action type from a DLP rule's chromeAction field.
 * @param {object} action - The chromeAction object
 * @returns {string} One of: block, warn, audit, watermark, unknown
 */
function classifyAction(action) {
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
 * Fetches all environment data and returns raw collections for
 * both summary computation and detail pagination.
 * @param {import('../../lib/api/admin_sdk_client.js').AdminSdkClient} adminSdkClient - Client for customer, org unit, and license data
 * @param {import('../../lib/api/chrome_management_client.js').ChromeManagementClient} chromeManagementClient - Client for browser and device telemetry
 * @param {import('../../lib/api/chrome_policy_client.js').ChromePolicyClient} chromePolicyClient - Client for verifying connector and extension policies
 * @param {import('../../lib/api/cloud_identity_client.js').CloudIdentityClient} cloudIdentityClient - Client for listing DLP rules and detectors
 * @param {string} customerId - The Chrome customer ID used for scoping requests
 * @param {string} authToken - The Bearer token for authorized API access
 * @param {object} [options] - Additional options including beyondcorpClient, projectId, and flags
 * @returns {Promise<object>} A consolidated object containing raw data from all services
 */
async function fetchEnvironment(
  adminSdkClient,
  chromeManagementClient,
  chromePolicyClient,
  cloudIdentityClient,
  customerId,
  authToken,
  options = {},
) {
  const { beyondcorpClient, cloudResourceManagerClient, projectId, flags } = options

  const [
    customerData,
    orgUnitsData,
    subscriptionData,
    dlpPolicies,
    detectorPolicies,
    browserVersions,
    securityInsights,
    contentTransfers,
    urlVisits,
  ] = await Promise.all([
    adminSdkClient.getCustomerId(authToken),
    adminSdkClient.listOrgUnits({ customerId }, authToken),
    adminSdkClient.checkCepSubscription(customerId, authToken).catch(err => {
      logger.error(`${TAGS.API} Error checking CEP subscription in diagnosis:`, err)
      return null
    }),
    cloudIdentityClient.listDlpRules(authToken),
    cloudIdentityClient.listDetectors(authToken),
    chromeManagementClient.countBrowserVersions(customerId, null, authToken),
    chromeManagementClient.checkSecurityInsightsStatus(customerId, authToken).catch(err => {
      logger.error(`${TAGS.API} Error fetching security insights status in diagnosis:`, err)
      return { insightsState: 'INSIGHTS_ENABLEMENT_STATE_UNSPECIFIED', error: true }
    }),
    chromeManagementClient.queryContentTransfers(customerId, {}, authToken).catch(err => {
      logger.error(`${TAGS.API} Error fetching content transfers in diagnosis:`, err)
      return { error: true, message: err.message }
    }),
    chromeManagementClient.queryUrlVisits(customerId, {}, authToken).catch(err => {
      logger.error(`${TAGS.API} Error fetching URL visits in diagnosis:`, err)
      return { error: true, message: err.message }
    }),
  ])

  const orgUnits = orgUnitsData?.organizationUnits || []
  const rootOU = orgUnits.find(ou => ou.orgUnitPath === '/') || orgUnits[0]
  const rootOUId = rootOU?.orgUnitId?.replace('id:', '') || null

  const customer = {
    customerId: customerData?.id || customerId || 'unknown',
    domain: customerData?.customerDomain,
  }

  const subItems = subscriptionData?.items || []
  // Fix: The subscription is active if the API call succeeded, even if 0 users are assigned
  const subscription = {
    isActive: !!subscriptionData,
    assignmentCount: subItems.length,
  }

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
      Object.entries(CONNECTOR_TYPES).map(async ([key, policyKey]) => {
        const page = CONNECTOR_LINK_MAPPING[key]
        const uiLink = page ? `https://admin.google.com/ac/chrome/settings/user/details/${page}` : null
        try {
          const schema = ConnectorPolicyFilter[policyKey]
          const policies = await chromePolicyClient.getConnectorPolicy(customerId, rootOUId, schema, authToken)
          const analysis = analyzeConnectorPolicy(policyKey, policies)
          return [
            key,
            {
              configured: analysis.isConfigured,
              isEnabled: analysis.isEnabled,
              uiLink,
              policyCount: policies.length,
              findings: analysis.findings,
            },
          ]
        } catch {
          return [key, { configured: false, isEnabled: false, uiLink, policyCount: 0, error: true }]
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

  let normalizedContentTransfers = contentTransfers
  let normalizedUrlVisits = urlVisits
  if (securityInsights?.insightsState !== 'INSIGHTS_ENABLED') {
    normalizedContentTransfers = null
    normalizedUrlVisits = null
  }

  let secureGateway = null
  if (flags?.isEnabled(FLAGS.SECURE_GATEWAY_ENABLED)) {
    if (!projectId) {
      secureGateway = { projectId: null, gateways: [], skipped: true }
    } else if (beyondcorpClient) {
      try {
        const rawGateways = await beyondcorpClient.listGateways(projectId, authToken)
        let projectIamPolicy = null
        let projectIamPolicyError = null
        if (cloudResourceManagerClient) {
          try {
            projectIamPolicy = await cloudResourceManagerClient.getProjectIamPolicy(projectId, authToken)
          } catch (err) {
            logger.error(`${TAGS.API} Error fetching project IAM policy for ${projectId} in diagnosis:`, err)
            projectIamPolicyError = err.message
          }
        }
        const gateways = await Promise.all(
          (rawGateways || []).map(async gw => {
            const gatewayId = gw.name ? gw.name.split('/').pop() : gw.displayName
            try {
              const apps = await beyondcorpClient.listApplications(projectId, gatewayId, authToken)
              return { ...gw, applications: apps || [] }
            } catch (err) {
              logger.error(`${TAGS.API} Error fetching applications for gateway ${gatewayId} in diagnosis:`, err)
              return { ...gw, applications: [], applicationsError: err.message }
            }
          }),
        )
        secureGateway = { projectId, gateways, projectIamPolicy, projectIamPolicyError, error: null }
      } catch (err) {
        logger.error(`${TAGS.API} Error fetching secure gateways in diagnosis:`, err)
        secureGateway = { projectId, gateways: [], error: err.message }
      }
    }
  }

  return {
    customer,
    orgUnits,
    subscription,
    versions,
    allDlpRules,
    allDetectors,
    connectors,
    sebExtension,
    securityInsights,
    contentTransfers: normalizedContentTransfers,
    urlVisits: normalizedUrlVisits,
    secureGateway,
  }
}

/**
 * Registers the 'diagnose_environment' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 * @param {object} options - Must include all API clients
 * @param {object} sessionState - State object for the current session
 */
export function registerDiagnoseEnvironmentTool(server, options, sessionState) {
  const {
    adminSdkClient,
    chromeManagementClient,
    chromePolicyClient,
    cloudIdentityClient,
    featureFlags: flags = defaultFeatureFlags,
  } = options
  const beyondcorpClient = options.beyondcorpClient || options.apiClients?.beyondcorp
  const cloudResourceManagerClient = options.cloudResourceManagerClient || options.apiClients?.cloudResourceManager

  const isSecureGatewayEnabled = flags.isEnabled(FLAGS.SECURE_GATEWAY_ENABLED)

  server.registerTool(
    'diagnose_environment',
    {
      description: `Runs a health check of the Chrome Enterprise Premium environment.

By default returns a **summary** with counts and pre-computed issues — no large arrays. The agent should present these findings to the user.

To drill into detail, pass a 'section' parameter:
- "orgUnits" — paginated list of organizational units
- "dlpRules" — paginated list of DLP rules with action types
- "detectors" — paginated list of content detectors
- "browserVersions" — all browser version counts${isSecureGatewayEnabled ? '\n- "secureGateways" — paginated list of secure gateways' : ''}

Use 'limit' and 'offset' for pagination on large datasets.`,
      inputSchema: z.object({
        customerId: z.string().optional().describe('The Chrome customer ID. Auto-resolved if omitted.'),
        projectId: z
          .string()
          .optional()
          .describe('The Google Cloud project ID (required to diagnose Secure Gateways).'),
        section: z
          .enum(['orgUnits', 'dlpRules', 'detectors', 'browserVersions', 'secureGateways'])
          .optional()
          .describe('Drill into a specific section with paginated results. Omit for summary.'),
        limit: z.number().int().min(1).max(200).optional().describe('Page size for detail sections (default 50).'),
        offset: z.number().int().min(0).optional().describe('Pagination offset for detail sections (default 0).'),
      }),
      outputSchema: z.looseObject({}),
    },
    guardedToolCall(
      {
        handler: async ({ customerId, projectId, section, limit, offset }, { _requestInfo, authToken }) => {
          logger.info(`${TAGS.MCP} diagnose_environment: starting (section=${section || 'summary'})`)

          const env = await fetchEnvironment(
            adminSdkClient,
            chromeManagementClient,
            chromePolicyClient,
            cloudIdentityClient,
            customerId,
            authToken,
            { beyondcorpClient, cloudResourceManagerClient, projectId, flags },
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
  const {
    customer,
    orgUnits,
    subscription,
    versions,
    allDlpRules,
    allDetectors,
    connectors,
    sebExtension,
    securityInsights,
    contentTransfers,
    urlVisits,
    secureGateway,
  } = env

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
    securityInsights,
    contentTransfers,
    urlVisits,
    secureGateway,
    browserVersions: { total: versions.length, deviceCount: totalDevices },
    issues: [],
  }
  sc.issues = computeIssues(sc)

  const issueCount = sc.issues.length
  const critical = sc.issues.filter(i => i.severity === 'critical').length
  const high = sc.issues.filter(i => i.severity === 'high').length
  const medium = sc.issues.filter(i => i.severity === 'medium').length
  const warning = sc.issues.filter(i => i.severity === 'warning').length

  let summary = `## Environment Health Check\n\n`
  summary += `> **Scope:** Health check is scoped to the Root Organizational Unit (/). Sub-OU overrides are not included in this summary.\n\n`
  summary += `**Customer:** ${customer.customerId} (${customer.domain || 'unknown domain'})\n`
  summary += `**Org Units:** ${orgUnits.length}\n`
  summary += `**CEP Subscription:** ${subscription.isActive ? `Active (${subscription.assignmentCount} licenses)` : 'Not active'}\n`
  summary += `**Security Insights:** ${
    securityInsights?.insightsState === 'INSIGHTS_ENABLED'
      ? 'Enabled'
      : securityInsights?.insightsState === 'INSIGHTS_DISABLED'
        ? 'Disabled'
        : 'Unknown/Unspecified'
  }\n`

  const totalTransfers =
    contentTransfers?.summaries?.find(s => s.metric === 'CONTENT_TRANSFERS_METRIC_TOTAL_TRANSFERS')?.count || '0'
  const sensitiveTransfers =
    contentTransfers?.summaries?.find(s => s.metric === 'CONTENT_TRANSFERS_METRIC_SENSITIVE_DATA_TRANSFERS')?.count ||
    '0'
  const suspiciousVisits =
    urlVisits?.summaries?.find(s => s.metric === 'URL_VISITS_METRIC_TOTAL_SUSPICIOUS_URL_VISITS')?.count || '0'

  summary += `**Security Insights Data:**\n`
  if (!contentTransfers || !urlVisits) {
    summary += `  - Status: N/A (Security Insights is disabled or unspecified)\n`
  } else if (contentTransfers.error || urlVisits.error) {
    summary += `  - Status: ⚠️ Query failed (see issues below)\n`
  } else {
    summary += `  - Content Transfers (Total/Sensitive): ${totalTransfers} / ${sensitiveTransfers}\n`
    summary += `  - Suspicious URL Visits: ${suspiciousVisits}\n`
  }

  summary += `**DLP Rules:** ${allDlpRules.length} total (${activeRules.length} active: ${dlpRuleSummary.byAction.block} block, ${dlpRuleSummary.byAction.warn} warn, ${dlpRuleSummary.byAction.audit} audit, ${dlpRuleSummary.byAction.watermark} watermark)\n`
  summary += `**Detectors:** ${allDetectors.length}\n`
  summary += `**Browser Versions:** ${versions.length} versions across ${totalDevices} devices\n`
  summary += `**SEB Extension:** ${sebExtension.isInstalled ? 'Force-installed' : 'Not installed'}\n`

  if (secureGateway) {
    if (secureGateway.skipped) {
      summary += `**Secure Gateways:** Not checked (provide 'projectId' parameter to diagnose Secure Gateways)\n`
    } else if (secureGateway.error) {
      summary += `**Secure Gateways (project: ${secureGateway.projectId}):** ⚠️ Query failed (see issues below)\n`
    } else {
      const gateways = secureGateway.gateways || []
      const activeCount = gateways.filter(g => g.state === 'RUNNING').length
      const sdCount = gateways.filter(g => Boolean(g.serviceDiscovery)).length
      const appCount = gateways.reduce((sum, g) => sum + (g.applications ? g.applications.length : 0), 0)
      summary += `**Secure Gateways (project: ${secureGateway.projectId}):** ${gateways.length} total (${activeCount} active, ${sdCount} with Service Discovery, ${appCount} app(s))\n`
    }
  }

  summary += `\n`

  if (issueCount === 0) {
    summary += `**Result: No issues found.** The environment appears healthy.\n`
  } else {
    let countsStr = `${critical} critical, ${high} high, ${medium} medium`
    if (warning > 0) {
      countsStr += `, ${warning} warning`
    }
    summary += `**Result: ${issueCount} issue(s) found** (${countsStr})\n\n`
    for (const issue of sc.issues) {
      const icon =
        issue.severity === 'critical'
          ? '🔴'
          : issue.severity === 'high'
            ? '🟠'
            : issue.severity === 'medium'
              ? '🟡'
              : 'ℹ️'
      let remediation = ''
      if (issue.component === 'securityInsights' && issue.severity === 'critical') {
        remediation =
          ' -> Action: Use the `security_insights` tool to enable this feature (e.g. `security_insights enable`).'
      } else if (issue.component === 'securityInsightsData' && issue.severity === 'medium') {
        remediation =
          ' -> Action: Verify that the API client has the required scopes: `chrome.management.reports.readonly`.'
      }
      summary += `${icon} **${issue.severity.toUpperCase()}** (${issue.component}): ${issue.message}${remediation}\n`
    }
  }

  const sectionsList = ['"orgUnits"', '"dlpRules"', '"detectors"', '"browserVersions"']
  if (secureGateway) {
    sectionsList.push('"secureGateways"')
  }
  summary += `\nTo drill into details, call diagnose_environment again with section=${sectionsList.join(', ')}.`

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
    case 'secureGateways':
      allItems = (env.secureGateway?.gateways || []).map(gw => ({
        name: gw.name,
        displayName: gw.displayName,
        state: gw.state,
        serviceDiscovery: Boolean(gw.serviceDiscovery),
        applicationCount: gw.applications ? gw.applications.length : 0,
      }))
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
      case 'secureGateways':
        summary += items
          .map(
            (gw, i) =>
              `${offset + i + 1}. **${gw.displayName || gw.name}** — ${gw.state}, Service Discovery: ${gw.serviceDiscovery ? 'enabled' : 'disabled'}, Applications: ${gw.applicationCount}`,
          )
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
