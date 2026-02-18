/**
 * @fileoverview Tool definition for listing organizational units.
 */

import { guardedToolCall, getAuthToken, commonSchemas } from '../utils.js'
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
                customerId: commonSchemas.customerId,
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
