/**
 * @fileoverview Tool definition for deleting DLP rules.
 */

import { z } from 'zod'
import { guardedToolCall, getAuthToken } from '../utils.js'
import { TAGS } from '../../lib/constants.js'

/**
 * Registers the 'delete_dlp_rule' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 */
export function registerDeleteDlpRuleTool(server, options) {
    const { cloudIdentityClient } = options

    server.registerTool(
        'delete_dlp_rule',
        {
            description: 'Deletes a Chrome DLP rule.',
            inputSchema: {
                policyName: z.string().describe(`The name of the policy to delete (e.g. policies/akajj264aovytg7aau)`),
            },
        },
        guardedToolCall(
            {
                handler: async ({ policyName }, { requestInfo }) => {
                    const authToken = getAuthToken(requestInfo)
                    await cloudIdentityClient.deleteDlpRule(policyName, authToken)

                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Successfully deleted DLP rule: ${policyName}`,
                            },
                        ],
                    }
                },
            },
            options.apiOptions,
        ),
    )
}
