/**
 * @fileoverview Tool definition for listing DLP rules.
 */

import { z } from 'zod'

import { listDlpPolicies } from '../../lib/api/cloudidentity.js'
import { guardedToolCall, getAuthToken } from '../utils.js'

const SUPPORTED_TRIGGERS = [
    'google.workspace.chrome.file.v1.upload',
    'google.workspace.chrome.file.v1.download',
    'google.workspace.chrome.web_content.v1.upload',
    'google.workspace.chrome.page.v1.print',
    'google.workspace.chrome.url.v1.navigation',
]

/**
 * Registers the 'list_dlp_rules' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {boolean} options.gcpCredentialsAvailable - Whether GCP credentials are available.
 */
export function registerListDlpRulesTool(server, options) {
    server.registerTool(
        'list_dlp_rules',
        {
            description: `Lists all DLP rules or detectors for a given customer. 
        The tool returns rules with multiple attributes, parse them and return names, summarize the action`,
            inputSchema: {
                type: z
                    .enum(['rule', 'detector'])
                    .optional()
                    .describe(`Filter by policy type. Defaults to "rule". Set to "detector" to list detectors.`),
                customerId: z.string().optional().describe(`The customer ID to list policies for.`),
            },
        },
        guardedToolCall({
            handler: async ({ type, customerId }, { requestInfo }) => {
                const authToken = getAuthToken(requestInfo)
                // Default to 'rule' if not specified, since the tool name implies rules
                const policyType = type || 'rule'

                const policies = await listDlpPolicies(policyType, authToken, customerId)

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
                                text: `No DLP ${policyType}s found with supported triggers.`,
                            },
                        ],
                    }
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: `DLP ${policyType}:\n${JSON.stringify(filteredPolicies, null, 2)}`,
                        },
                    ],
                }
            },
        }),
    )
}
