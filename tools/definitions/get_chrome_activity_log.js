/**
 * @fileoverview Tool definition for getting the Chrome activity log.
 */

import { z } from 'zod'

import { listChromeActivities } from '../../lib/api/admin_sdk.js'
import { guardedToolCall, getAuthToken } from '../utils.js'

/**
 * Registers the 'get_chrome_activity_log' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {boolean} options.gcpCredentialsAvailable - Whether GCP credentials are available.
 */
export function registerGetChromeActivityLogTool(server, options) {
    server.registerTool(
        'get_chrome_activity_log',
        {
            description: `Gets a log of Chrome browser activity for a given user. 
        By default, it retrieves events from the last 10 days unless a specific start time is provided. 
        Do not prompt users for additional inputs; use the defaults if no values are provided.`,
            inputSchema: {
                userKey: z
                    .string()
                    .describe(`The user key to get activities for. Use "all" for all users.`)
                    .default('all'),
                eventName: z.string().optional().describe(`The name of the event to filter by.`),
                startTime: z
                    .string()
                    .optional()
                    .describe(
                        `The start time of the range to get activities for (RFC3339 timestamp). Defaults to 10 days ago if not specified.`,
                    ),
                endTime: z
                    .string()
                    .optional()
                    .describe(`The end time of the range to get activities for (RFC3339 timestamp). Defaults to now.`),
                maxResults: z.number().optional().describe(`The maximum number of results to return.`),
                customerId: z
                    .string()
                    .optional()
                    .describe(`The customer ID to filter by. Defaults to the current customer.`),
            },
        },
        guardedToolCall({
            transform: params => {
                if (!params.startTime) {
                    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
                    params.startTime = tenDaysAgo.toISOString()
                }
                if (!params.endTime) {
                    params.endTime = new Date().toISOString()
                }
                return params
            },
            handler: async ({ userKey, eventName, startTime, endTime, maxResults, customerId }, { requestInfo }) => {
                const authToken = getAuthToken(requestInfo)

                const activities = await listChromeActivities(
                    {
                        userKey,
                        eventName,
                        startTime,
                        endTime,
                        maxResults,
                        customerId,
                    },
                    authToken,
                )

                if (!activities || activities.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'No Chrome activity found for the specified criteria.',
                            },
                        ],
                    }
                }

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Chrome activity:\n${JSON.stringify(activities, null, 2)}`,
                        },
                    ],
                }
            },
        }),
    )
}
