/**
 * @fileoverview Tool definition for listing DLP (Data Loss Prevention) rules.
 */
import { z } from 'zod'
import { guardedToolCall, getAuthToken, commonSchemas } from '../utils.js'
import { TAGS } from '../../lib/constants.js'

const SUPPORTED_TRIGGERS = [
    'google.workspace.chrome.file.v1.upload',
    'google.workspace.chrome.file.v1.download',
    'google.workspace.chrome.web_content.v1.upload',
    'google.workspace.chrome.page.v1.print',
    'google.workspace.chrome.url.v1.navigation',
]

/**
 * Registers the 'list_dlp_rules' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 */
export function registerListDlpRulesTool(server, options) {
    const { cloudIdentityClient } = options

    server.registerTool(
        'list_dlp_rules',
        {
            description: 'Lists Data Loss Prevention (DLP) rules or detectors with supported Chrome triggers.',
            inputSchema: {
                type: z
                    .enum(['rule', 'detector'])
                    .default('rule')
                    .describe("Type of policy to list: 'rule' for DLP rules, 'detector' for URL lists/detectors."),
                customerId: commonSchemas.customerId,
            },
        },
        guardedToolCall(
            {
                handler: async (params, { requestInfo }) => {
                    const { type, customerId } = params
                    const authToken = getAuthToken(requestInfo)

                    const policies = await cloudIdentityClient.listDlpPolicies(type, authToken, customerId)
                    if (!policies || policies.length === 0) {
                        return { content: [{ type: 'text', text: `No DLP policies of type '${type}' found.` }] }
                    }

                    const filteredPolicies = policies.filter(policy => {
                        const triggers = policy.setting?.value?.triggers
                        if (triggers) {
                            return triggers.some(trigger => SUPPORTED_TRIGGERS.includes(trigger))
                        }
                        return false
                    })

                    if (!filteredPolicies || filteredPolicies.length === 0) {
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `No DLP ${type}s found with supported triggers.`,
                                },
                            ],
                        }
                    }

                    return {
                        content: [
                            {
                                type: 'text',
                                text: `DLP ${type}:\n${JSON.stringify(filteredPolicies, null, 2)}`,
                            },
                        ],
                    }
                },
            },
            options.apiOptions,
        ),
    )
}
