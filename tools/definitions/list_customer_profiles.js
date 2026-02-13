/**
 * @fileoverview Tool definition for listing customer profiles.
 */

import { listCustomerProfiles } from '../../lib/api/chromemanagement.js'
import { guardedToolCall, commonSchemas } from '../utils.js'

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
        guardedToolCall({
            handler: async ({ customerId }) => {
                const profiles = await listCustomerProfiles(customerId)

                if (!profiles || profiles.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `No profiles found for customer ${customerId}.`,
                            },
                        ],
                    }
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Browser versions for customer ${customerId}:\n${JSON.stringify(profiles)}`,
                        },
                    ],
                }
            },
        }),
    )
}
