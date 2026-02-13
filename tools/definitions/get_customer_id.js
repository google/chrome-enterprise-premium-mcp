/**
 * @fileoverview Tool definition for retrieving the customer ID.
 */

import { getCustomerId } from '../../lib/api/admin_sdk.js';
import { guardedToolCall, getAuthToken } from '../utils.js';


/**
 * Registers the 'get_customer_id' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {boolean} options.gcpCredentialsAvailable - Whether GCP credentials are available.
 */
export function registerGetCustomerIdTool(server, options) {
  server.registerTool(
    'get_customer_id',
    {
      description: 'Gets the customer ID for the authenticated user. All other tools that require a customer ID should get it using this tool instead of asking the user for it.',
      inputSchema: {},
    },
    guardedToolCall({
      handler: async ({}, { requestInfo }) => {
        const authToken = getAuthToken(requestInfo);
        const customer = await getCustomerId(authToken);

        if (!customer) {
          return {
            content: [
              {
                type: 'text',
                text: 'Could not retrieve customer ID.',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Customer ID: ${customer.id}`,
            },
          ],
        };
      },
      skipAutoResolve: true
    })
  );
}