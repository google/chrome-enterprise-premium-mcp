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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { isObject, getString } from '../../lib/util/helpers.js'

const ListOrgUnitsSchema = z.object({
  customerId: z.string().optional(),
})

type ListOrgUnitsParams = z.infer<typeof ListOrgUnitsSchema>

/**
 * Registers the 'list_org_units' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerListOrgUnitsTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const adminSdkClient = apiClients?.adminSdk
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
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          if (!adminSdkClient) {
            throw new Error('adminSdkClient is required for list_org_units')
          }

          // Strictly parse using Zod
          const safeParams: ListOrgUnitsParams = ListOrgUnitsSchema.parse(params)
          const { customerId } = safeParams

          logger.debug(`${TAGS.MCP} Calling 'list_org_units' with customerId: ${customerId || ''}`)
          const orgUnitsData = await adminSdkClient.listOrgUnits({ customerId }, authToken || '')

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

          const items = orgUnits.filter(isObject)

          const formattedOrgUnits = items
            .map(ou => {
              const name = getString(ou, 'name') || ''
              const pathStr = getString(ou, 'orgUnitPath') || ''
              const id = getString(ou, 'orgUnitId') || ''
              const parentPath = getString(ou, 'parentOrgUnitPath')
              const parentId = getString(ou, 'parentOrgUnitId')
              const parentInfo = parentPath || parentId || '(none)'
              return `- **${name}** — path: ${pathStr}, ID: \`${id}\`, parent: ${parentInfo}`
            })
            .join('\n')

          const resourceMap = items
            .map(ou => {
              const name = getString(ou, 'name') || ''
              const id = getString(ou, 'orgUnitId') || ''
              return `- "${name}" → \`${id}\``
            })
            .join('\n')

          logger.debug(`${TAGS.MCP} Successfully listed organizational units.`)
          const sc = { orgUnits: items }
          return formatToolResponse({
            summary: `## Organizational Units (${items.length})\n\n${formattedOrgUnits}\n\nResource names for API operations:\n${resourceMap}`,
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
