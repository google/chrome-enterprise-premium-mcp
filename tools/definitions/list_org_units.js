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
 * @fileoverview Tool definition for listing organizational units.
 */

import { guardedToolCall, getAuthToken, inputSchemas } from '../utils.js'
import { TAGS } from '../../lib/constants.js'

/**
 * Registers the 'list_org_units' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/admin_sdk_client.js').AdminSdkClient} options.adminSdkClient - The Admin SDK client instance.
 */
export function registerListOrgUnitsTool(server, options) {
  const { adminSdkClient } = options

  server.registerTool(
    'list_org_units',
    {
      description: `Lists all organizational units for a given customer.
        This tool should be used whenever another tool requires an org unit ID.
        It provides users with a list of organizational unit names,
        so they do not need to manually search for the org unit ID.`,
      inputSchema: {
        customerId: inputSchemas.customerId,
      },
    },
    guardedToolCall(
      {
        handler: async ({ customerId }, { requestInfo }) => {
          const authToken = getAuthToken(requestInfo)
          const orgUnitsData = await adminSdkClient.listOrgUnits({ customerId }, authToken)

          const orgUnits = orgUnitsData?.organizationUnits // Extract the array

          if (!orgUnits || orgUnits.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No organizational units found for the specified criteria.',
                },
              ],
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: `Organizational Units:\n${JSON.stringify(orgUnits, null, 2)}`,
              },
            ],
          }
        },
      },
      options.apiOptions,
    ),
  )
}
