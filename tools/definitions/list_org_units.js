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
 * @file Tool definition for listing organizational units.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'list_org_units' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/admin_sdk_client.js').AdminSdkClient} options.adminSdkClient - The Admin SDK client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerListOrgUnitsTool(server, options, sessionState) {
  const { adminSdkClient } = options
  logger.debug(`${TAGS.MCP} Registering 'list_org_units' tool...`)

  server.registerTool(
    'list_org_units',
    {
      description: `Lists the Organizational Units (OUs) for the customer.
Use this tool to find the 'orgUnitId' required by most other Chrome management and policy tools. It provides the human-readable path and unique ID for each OU.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
      },
      outputSchema: z
        .object({
          orgUnits: z.array(commonOutputSchemas.orgUnit),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        /**
         * Handler for listing organizational units.
         * @param {object} params - The tool parameters.
         * @param {string} [params.customerId] - The Chrome customer ID.
         * @param {object} context - The tool execution context.
         * @param {object} context._requestInfo - The request info object.
         * @param {string} context.authToken - The OAuth2 access token.
         * @returns {Promise<object>} The formatted tool response.
         */
        handler: async ({ customerId }, { _requestInfo, authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'list_org_units' with customerId: ${customerId}`)
          const orgUnitsData = await adminSdkClient.listOrgUnits({ customerId }, authToken)

          const orgUnits = orgUnitsData?.organizationUnits

          if (!orgUnits || orgUnits.length === 0) {
            logger.debug(`${TAGS.MCP} No organizational units found.`)
            const sc = { orgUnits: [] }
            return formatToolResponse({
              summary: 'No organizational units found for the specified criteria.',
              data: sc,
              structuredContent: sc,
            })
          }

          const formattedOrgUnits = orgUnits
            .map(ou => {
              const parentInfo = ou.parentOrgUnitPath || ou.parentOrgUnitId || '(none)'
              return `- **${ou.name}** — path: ${ou.orgUnitPath}, ID: \`${ou.orgUnitId}\`, parent: ${parentInfo}`
            })
            .join('\n')

          const resourceMap = orgUnits.map(ou => `- "${ou.name}" → \`${ou.orgUnitId}\``).join('\n')

          logger.debug(`${TAGS.MCP} Successfully listed organizational units.`)
          const sc = { orgUnits }
          return formatToolResponse({
            summary: `## Organizational Units (${orgUnits.length})\n\n${formattedOrgUnits}\n\nResource names for API operations:\n${resourceMap}`,
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
