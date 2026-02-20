/**
 * @fileoverview Tool definition for retrieving the customer ID.
 */

import { guardedToolCall, getAuthToken } from '../utils.js'
import { TAGS } from '../../lib/constants.js'

/**
 * Registers the 'get_customer_id' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/admin_sdk_client.js').AdminSdkClient} options.adminSdkClient - The Admin SDK client instance.
 */
export function registerGetCustomerIdTool(server, options) {
  const { adminSdkClient } = options

  server.registerTool(
    'get_customer_id',
    {
      description: `Gets the customer ID for the authenticated user. All other tools that require a customer ID should get it using this tool instead of asking the user for it.`,
      inputSchema: {},
    },
    guardedToolCall(
      {
        handler: async (params, { requestInfo }) => {
          const authToken = getAuthToken(requestInfo)
          const customer = await adminSdkClient.getCustomerId(authToken)

          if (!customer) {
            console.error(`${TAGS.MCP} ✗ get_customer_id tool: Could not retrieve customer ID. Response:`, customer)
            return {
              content: [{ type: 'text', text: 'Could not retrieve customer ID.' }],
            }
          }
          return { content: [{ type: 'text', text: `Customer ID: ${customer.id}` }] }
        },
        skipAutoResolve: true,
      },
      options.apiOptions,
    ),
  )
}
