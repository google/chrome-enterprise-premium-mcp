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
 * @file Tool definition for listing CAA access levels.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Helper to format basic level posture conditions into human-readable string.
 * @param {object} basic The BasicLevel object from API.
 * @returns {string} Formatted conditions string.
 */
function formatBasicLevelConditions(basic) {
  if (!basic?.conditions || basic.conditions.length === 0) {
    return '(none)'
  }
  const parts = []
  basic.conditions.forEach((cond, index) => {
    const dp = cond.devicePolicy
    if (dp) {
      const restrictions = []
      if (dp.requireScreenlock) {
        restrictions.push('Screenlock')
      }
      if (dp.requireCorpOwned) {
        restrictions.push('Corp Owned')
      }
      if (dp.requireAdminApproval) {
        restrictions.push('Admin Approval')
      }
      if (dp.allowedEncryptionStatuses?.length) {
        restrictions.push(`Encryption: ${dp.allowedEncryptionStatuses.join(', ')}`)
      }
      if (dp.osConstraints?.length) {
        const osList = dp.osConstraints
          .map(c => `${c.osType}${c.minimumVersion ? ` (>= ${c.minimumVersion})` : ''}`)
          .join(', ')
        restrictions.push(`OS: ${osList}`)
      }
      if (restrictions.length > 0) {
        parts.push(`Condition #${index + 1}: ${restrictions.join('; ')}`)
      }
    }
  })
  return parts.length > 0 ? parts.join('\n  - ') : '(standard device conditions)'
}

/**
 * Registers the 'list_caa_access_levels' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/access_context_manager_client.js').AccessContextManagerClient} options.accessContextManagerClient - The Access Context Manager client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerListCaaAccessLevelsTool(server, options, sessionState) {
  const { accessContextManagerClient } = options
  logger.debug(`${TAGS.MCP} Registering 'list_caa_access_levels' tool...`)

  server.registerTool(
    'list_caa_access_levels',
    {
      description: `Lists Context-Aware Access (CAA) access levels for an organization.
Resolves the Access Policy for the specified (or cached) Organization ID, then lists all defined access levels within that policy.

When a user requests to create a new access level, agents should first invoke 'list_caa_access_levels' to check if an access level matching the user's described conditions already exists for the organization. If a matching access level is found, present that access level to the user and ask if they still wish to create a new one before proceeding with creation.

If an API returns a 403 Permission Denied error, the likely cause is missing IAM permissions.
Guide the user on fixing it by linking: https://docs.cloud.google.com/iam/docs/grant-role-console
Explicitly mention the required permissions as listed in the public API docs or recommend granting the 'Access Context Manager Reader' (roles/accesscontextmanager.policyReader) or 'Policy Admin' role (roles/accesscontextmanager.policyAdmin):
- List policies: 'accesscontextmanager.policies.list'
- List access levels: 'accesscontextmanager.accessLevels.list'`,
      inputSchema: z.looseObject({
        organizationId: z
          .string()
          .optional()
          .describe('Optional GCP Organization ID. If omitted, uses the cached organization ID.'),
        policyName: z
          .string()
          .optional()
          .describe(
            'Optional parent Access Policy resource name (e.g. "accessPolicies/12345"). If provided, skips organization policy resolution.',
          ),
        pageSize: z.number().optional().describe('Optional maximum number of access levels to return.'),
        pageToken: z.string().optional().describe('Optional page token for pagination.'),
        accessLevelFormat: z
          .enum(['AS_DEFINED', 'CEL'])
          .optional()
          .describe('Optional format for returned access levels (default: AS_DEFINED).'),
      }),
      outputSchema: z.looseObject({
        accessLevels: z.array(z.looseObject({})).optional(),
        nextPageToken: z.string().optional(),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { _requestInfo, authToken }) => {
          const {
            organizationId: inputOrgId,
            policyName: inputPolicyName,
            pageSize,
            pageToken,
            accessLevelFormat,
          } = params

          logger.debug(`${TAGS.MCP} Calling 'list_caa_access_levels'`)

          let policyName = inputPolicyName

          if (!policyName) {
            let orgId = inputOrgId || sessionState.organizationId
            if (!orgId && options.cloudResourceManagerClient) {
              try {
                const res = await options.cloudResourceManagerClient.searchOrganizations({}, authToken)
                const orgs = res?.organizations || []
                if (orgs.length > 0) {
                  const fetchedOrgId = orgs[0].name.split('/').pop()
                  const fetchedOrgName = orgs[0].name
                  if (sessionState) {
                    sessionState.organizationId = fetchedOrgId
                    sessionState.organizationName = fetchedOrgName
                  }
                  orgId = fetchedOrgId
                }
              } catch (e) {
                logger.debug(`${TAGS.MCP} Failed to auto-resolve organization ID: ${e.message}`)
              }
            }
            if (!orgId) {
              throw new Error(
                'Organization ID is required. Please provide organizationId or run search_organizations first to cache it.',
              )
            }
            const parent = orgId.startsWith('organizations/') ? orgId : `organizations/${orgId}`

            logger.debug(`${TAGS.MCP} Resolving access policies for parent: ${parent}`)
            const policiesResponse = await accessContextManagerClient.listAccessPolicies({ parent }, authToken)
            const policies = policiesResponse?.accessPolicies || []

            if (policies.length === 0) {
              logger.debug(`${TAGS.MCP} No access policy found for ${parent}`)
              const sc = { accessLevels: [] }
              return formatToolResponse({
                summary: `No Access Policy found for organization "${parent}". No access levels exist.`,
                data: sc,
                structuredContent: sc,
              })
            }

            policyName = policies[0].name
            logger.debug(`${TAGS.MCP} Resolved policy: ${policyName}`)
          }

          logger.debug(`${TAGS.MCP} Listing access levels for policy: ${policyName}`)
          const levelsData = await accessContextManagerClient.listAccessLevels(
            policyName,
            { pageSize, pageToken, accessLevelFormat },
            authToken,
          )

          const accessLevels = levelsData?.accessLevels || []
          const nextPageToken = levelsData?.nextPageToken

          if (accessLevels.length === 0) {
            logger.debug(`${TAGS.MCP} No access levels found in policy ${policyName}`)
            const sc = { accessLevels: [], nextPageToken }
            return formatToolResponse({
              summary: `No Access Levels found in policy \`${policyName}\`.`,
              data: sc,
              structuredContent: sc,
            })
          }

          const formattedLevels = accessLevels
            .map(level => {
              const shortName = level.name.split('/').pop()
              const desc = level.description ? ` — ${level.description}` : ''
              let details = ''
              if (level.basic) {
                details = `\n  - Conditions: ${formatBasicLevelConditions(level.basic)}`
              } else if (level.custom) {
                details = `\n  - Custom CEL: \`${level.custom.expr?.expression || 'N/A'}\``
              }
              return `- **${level.title || shortName}** (\`${level.name}\`)${desc}${details}`
            })
            .join('\n')

          const resourceMap = accessLevels
            .map(level => {
              const shortName = level.name.split('/').pop()
              return `- "${level.title || shortName}" → \`${level.name}\``
            })
            .join('\n')

          let summary = `## Access Levels (${accessLevels.length})\nPolicy: \`${policyName}\`\n\n${formattedLevels}\n\nResource names for API operations:\n${resourceMap}`
          if (nextPageToken) {
            summary += `\n\n*More access levels available. Use pageToken: \`${nextPageToken}\` to retrieve the next page.*`
          }

          const sc = { accessLevels, nextPageToken }
          return formatToolResponse({
            summary,
            data: sc,
            structuredContent: sc,
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
