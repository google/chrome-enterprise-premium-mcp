/**
 * @fileoverview Tool definition for listing organizational units.
 */

import { listOrgUnits } from '../../lib/api/admin_sdk.js';
import { gcpTool, getAuthToken, commonSchemas } from '../utils.js';


/**
 * Registers the 'list_org_units' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {boolean} options.gcpCredentialsAvailable - Whether GCP credentials are available.
 */
export function registerListOrgUnitsTool(server, options) {
  server.registerTool(
    'list_org_units',
    {
      description: 'Lists all organizational units for a given customer. This tool should be used whenever another tool requires an org unit ID. It provides users with a list of organizational unit names, so they do not need to manually search for the org unit ID.',
      inputSchema: {
        customerId: commonSchemas.customerId,
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ customerId }, { requestInfo }) => {
        try {
          const authToken = getAuthToken(requestInfo);
          const normalizedCustomerId = customerId === 'me' ? undefined : customerId;
          const orgUnits = await listOrgUnits({ customerId: normalizedCustomerId }, authToken);

          if (!orgUnits || orgUnits.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No organizational units found for the specified criteria.',
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `Organizational Units:\n${JSON.stringify(orgUnits, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error listing organizational units: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}