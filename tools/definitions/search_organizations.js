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
 * @file Tool definition for searching GCP organizations.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse, safeFormatResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'search_organizations' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/cloud_resource_manager_client.js').CloudResourceManagerClient} options.cloudResourceManagerClient - The CRM client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerSearchOrganizationsTool(server, options, sessionState) {
  const { cloudResourceManagerClient } = options
  logger.debug(`${TAGS.MCP} Registering 'search_organizations' tool...`)

  server.registerTool(
    'search_organizations',
    {
      description:
        'Searches for the GCP organization associated with the Workspace customer. ' +
        'Resolves and caches the Organization ID in the session for subsequent Context-Aware Access (CAA) operations.',
      inputSchema: z.object({
        customerId: z
          .string()
          .optional()
          .describe('The Workspace customer ID (e.g. C012345). Defaults to "my_customer".'),
      }),
      outputSchema: z.looseObject({}),
    },
    guardedToolCall(
      {
        handler: async ({ customerId }, { authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'search_organizations' with customerId: ${customerId}`)

          const result = await cloudResourceManagerClient.searchOrganizations(
            {
              filter: `owner.directorycustomerid:${customerId}`,
            },
            authToken,
          )

          return safeFormatResponse({
            rawData: result,
            toolName: 'search_organizations',
            formatFn: raw => {
              const orgs = raw?.organizations || []
              if (orgs.length === 0) {
                return formatToolResponse({
                  summary: `No GCP organization found associated with customer ID ${customerId}.`,
                  data: raw,
                  structuredContent: raw,
                })
              }

              const org = orgs[0]
              const orgId = org.name.split('/').pop()

              // Cache in sessionState for subsequent CAA tools (e.g. creating access levels)
              if (sessionState) {
                sessionState.organizationId = orgId
                sessionState.organizationName = org.name
                logger.info(`${TAGS.MCP} Cached organizationId: ${orgId} in sessionState.`)
              }

              const summary =
                `## Associated GCP Organization Found\n\n` +
                `- **Display Name:** ${org.displayName}\n` +
                `- **Resource Name:** \`${org.name}\` (ID: \`${orgId}\`)\n` +
                `- **Customer ID:** ${org.directoryCustomerId}\n` +
                `- **State:** ${org.state}\n\n` +
                `The Organization ID has been cached in the session for subsequent operations.`

              return formatToolResponse({
                summary,
                data: raw,
                structuredContent: raw,
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
