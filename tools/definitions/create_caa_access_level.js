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
 * @file Tool definition for creating CAA access levels.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'create_caa_access_level' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/access_context_manager_client.js').AccessContextManagerClient} options.accessContextManagerClient - The Access Context Manager client instance.
 * @param {import('../../lib/api/cloud_resource_manager_client.js').CloudResourceManagerClient} options.cloudResourceManagerClient - The Cloud Resource Manager client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerCreateCaaAccessLevelTool(server, options, sessionState) {
  const { accessContextManagerClient } = options
  logger.debug(`${TAGS.MCP} Registering 'create_caa_access_level' tool...`)

  const osTypeEnum = z.enum([
    'OS_UNSPECIFIED',
    'DESKTOP_MAC',
    'DESKTOP_WINDOWS',
    'DESKTOP_LINUX',
    'DESKTOP_CHROME_OS',
    'ANDROID',
    'IOS',
  ])

  const encryptionStatusEnum = z.enum(['ENCRYPTION_UNSPECIFIED', 'ENCRYPTION_UNSUPPORTED', 'UNENCRYPTED', 'ENCRYPTED'])

  const osConstraintSchema = z.object({
    osType: osTypeEnum.describe('The allowed OS type.'),
    minimumVersion: z.string().optional().describe('The minimum allowed OS version (e.g., "10.0.0").'),
    requireVerifiedChromeOs: z
      .boolean()
      .optional()
      .describe('Only allows requests from devices with verified Chrome OS.'),
  })

  server.registerTool(
    'create_caa_access_level',
    {
      description: `Creates a Context-Aware Access (CAA) access level with device posture requirements for an organization.
If the organization does not have an Access Policy, this tool will attempt to create a default one first.
This tool blocks and waits for the Access Level creation to complete before returning.

If an API returns a 403 Permission Denied error, the likely cause is missing IAM permissions.
Guide the user on fixing it by linking: https://docs.cloud.google.com/iam/docs/grant-role-console
Explicitly mention the required permissions as listed in the public API docs or recommend granting the 'Access Context Manager Policy Admin' role (roles/accesscontextmanager.policyAdmin):
- List policies: 'accesscontextmanager.policies.list'
- Create policy: 'accesscontextmanager.policies.create'
- Create access level: 'accesscontextmanager.accessLevels.create'`,
      inputSchema: z.looseObject({
        name: z
          .string()
          .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
          .max(50)
          .describe(
            'Unique identifier for the Access Level (e.g., "device_trust_level"). Must start with a letter and contain only alphanumeric/underscores.',
          ),
        title: z.string().describe('Human-readable title for the Access Level.'),
        description: z.string().optional().describe('Optional description of the Access Level.'),
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
        requireScreenlock: z.boolean().optional().describe('Whether screen lock is required.'),
        requireCorpOwned: z.boolean().optional().describe('Whether the device must be corp-owned.'),
        requireAdminApproval: z
          .boolean()
          .optional()
          .describe('Whether the device must be approved by an administrator.'),
        allowedEncryptionStatuses: z
          .array(encryptionStatusEnum)
          .optional()
          .describe('List of allowed encryption statuses (e.g., ["ENCRYPTED"]). If empty, all are allowed.'),
        osConstraints: z.array(osConstraintSchema).optional().describe('List of OS constraints.'),
      }),
      outputSchema: z.looseObject({
        accessLevel: z.looseObject({
          name: z.string(),
          title: z.string(),
          description: z.string().optional(),
          basic: z.looseObject({}),
        }),
      }),
    },
    guardedToolCall(
      {
        skipAutoResolve: true,
        handler: async (params, { _requestInfo, authToken }) => {
          const {
            name,
            title,
            description,
            organizationId: inputOrgId,
            policyName: inputPolicyName,
            requireScreenlock,
            requireCorpOwned,
            requireAdminApproval,
            allowedEncryptionStatuses,
            osConstraints,
          } = params

          logger.debug(`${TAGS.MCP} Calling 'create_caa_access_level' for: ${name}`)

          let policyName = inputPolicyName

          if (!policyName) {
            // Resolve organizationId
            const orgId = inputOrgId || sessionState.organizationId
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
              logger.debug(`${TAGS.MCP} No Access Policy found. Creating a new one...`)
              const policyPayload = {
                parent,
                title: 'Default Access Policy',
              }
              const createOp = await accessContextManagerClient.createAccessPolicy(policyPayload, authToken)
              logger.debug(`${TAGS.MCP} Access Policy creation initiated. Operation: ${createOp.name}`)
              const createdPolicy = await accessContextManagerClient.waitForOperation(createOp.name, authToken)
              policyName = createdPolicy?.name || createOp.response?.name
              if (!policyName) {
                throw new Error(
                  `Failed to resolve Access Policy name after creation. Operation response: ${JSON.stringify(createdPolicy)}`,
                )
              }
              logger.debug(`${TAGS.MCP} Created new Access Policy: ${policyName}`)
            } else {
              // Use the first policy found
              policyName = policies[0].name
              logger.debug(`${TAGS.MCP} Resolved policy: ${policyName}`)
            }
          }

          // Construct AccessLevel resource
          const fullAccessLevelName = `${policyName}/accessLevels/${name}`

          const accessLevelPayload = {
            name: fullAccessLevelName,
            title,
            description,
            basic: {
              conditions: [
                {
                  devicePolicy: {
                    requireScreenlock: requireScreenlock || false,
                    requireCorpOwned: requireCorpOwned || false,
                    requireAdminApproval: requireAdminApproval || false,
                    allowedEncryptionStatuses: allowedEncryptionStatuses || [],
                    osConstraints:
                      osConstraints?.map(c => ({
                        osType: c.osType,
                        minimumVersion: c.minimumVersion,
                        requireVerifiedChromeOs: c.requireVerifiedChromeOs,
                      })) || [],
                  },
                },
              ],
            },
          }

          logger.debug(`${TAGS.MCP} Creating access level with payload:`, JSON.stringify(accessLevelPayload, null, 2))

          const operation = await accessContextManagerClient.createAccessLevel(
            policyName,
            accessLevelPayload,
            authToken,
          )

          logger.debug(`${TAGS.MCP} Access level creation initiated. Operation: ${operation.name}`)

          // Wait for operation to complete
          const createdAccessLevel = await accessContextManagerClient.waitForOperation(operation.name, authToken)

          logger.debug(
            `${TAGS.MCP} Access level operation completed. Response:`,
            JSON.stringify(createdAccessLevel, null, 2),
          )

          const levelTitle = createdAccessLevel?.title || title
          const levelName = createdAccessLevel?.name || fullAccessLevelName
          const levelDesc = createdAccessLevel?.description || description
          const levelResource = createdAccessLevel || accessLevelPayload

          const summary =
            `## Access Level Created\n\n` +
            `- **Title**: ${levelTitle}\n` +
            `- **Name**: \`${levelName}\`\n` +
            (levelDesc ? `- **Description**: ${levelDesc}\n` : '') +
            `\n### Device restrictions configured:\n` +
            `- Require Screenlock: ${requireScreenlock ? 'Yes' : 'No'}\n` +
            `- Require Corp Owned: ${requireCorpOwned ? 'Yes' : 'No'}\n` +
            `- Require Admin Approval: ${requireAdminApproval ? 'Yes' : 'No'}\n` +
            (allowedEncryptionStatuses?.length
              ? `- Allowed Encryption: ${allowedEncryptionStatuses.join(', ')}\n`
              : '') +
            (osConstraints?.length
              ? `- OS Constraints: ${osConstraints.map(c => `${c.osType}${c.minimumVersion ? ` (>= ${c.minimumVersion})` : ''}`).join(', ')}\n`
              : '')

          return formatToolResponse({
            summary,
            data: { accessLevel: levelResource },
            structuredContent: { accessLevel: levelResource },
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
