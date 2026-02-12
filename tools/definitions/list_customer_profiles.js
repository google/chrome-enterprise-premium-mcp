/**
 * @fileoverview Tool definition for listing customer profiles.
 */

import { listCustomerProfiles } from '../../lib/api/chromemanagement.js';
import { gcpTool, commonSchemas } from '../utils.js';


/**
 * Registers the 'list_customer_profiles' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {boolean} options.gcpCredentialsAvailable - Whether GCP credentials are available.
 */
export function registerCustomerProfileTool(server, options) {
  server.registerTool(
    'list_customer_profiles',
    {
      description: 'Lists all customer profiles for a given customer.',
      inputSchema: {
        customerId: commonSchemas.customerId,
      },
    },
    gcpTool(
      options.gcpCredentialsAvailable,
      async ({ customerId }) => {
        const normalizedCustomerId = customerId === 'me' ? undefined : customerId;

        if (normalizedCustomerId && typeof normalizedCustomerId !== 'string') {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Customer ID must be a string.',
              },
            ],
          };
        }

        try {
          const profiles = await listCustomerProfiles(
            normalizedCustomerId
          );

          if (!profiles || profiles.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No profiles found for customer ${normalizedCustomerId}.`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `Browser versions for customer ${normalizedCustomerId}:\n${JSON.stringify(profiles)}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error listing customer profiles: ${error.message}`,
              },
            ],
          };
        }
      }
    )
  );
}