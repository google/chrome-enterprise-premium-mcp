/**
 * @fileoverview Tool definition for listing customer profiles.
 */

import { guardedToolCall, commonSchemas, getAuthToken } from '../utils.js'
import { TAGS } from '../../lib/constants.js'

/**
 * Registers the 'list_customer_profiles' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_management_client.js').ChromeManagementClient} options.chromeManagementClient - The Chrome Management client instance.
 */
export function registerCustomerProfileTool(server, options) {
    const { chromeManagementClient } = options

    server.registerTool(
        'list_customer_profiles',
        {
            description: 'Lists all customer profiles for a given customer.',
            inputSchema: {
                customerId: commonSchemas.customerId,
            },
        },
        guardedToolCall(
            {
                handler: async ({ customerId }, { requestInfo }) => {
                    try {
                        const authToken = getAuthToken(requestInfo)
                        const profiles = await chromeManagementClient.listCustomerProfiles(customerId, null, authToken) // Added null for progressCallback

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
                                    text: `Customer profiles for customer ${customerId}:\n${JSON.stringify(profiles, null, 2)}`, // Improved formatting
                                },
                            ],
                        }
                    } catch (error) {
                        return {
                            content: [{ type: 'text', text: `Error listing customer profiles: ${error.message}` }],
                        }
                    }
                },
            },
            options.apiOptions,
        ),
    )
}
