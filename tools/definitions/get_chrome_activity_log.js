/*
Copyright 2026 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/**
 * @fileoverview Tool definition for getting the Chrome activity log.
 */

import { z } from 'zod'

import { guardedToolCall, formatToolResponse, safeFormatResponse } from '../utils/wrapper.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'get_chrome_activity_log' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/admin_sdk_client.js').AdminSdkClient} options.adminSdkClient - The Admin SDK client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerGetChromeActivityLogTool(server, options, sessionState) {
  const { adminSdkClient } = options
  logger.debug(`${TAGS.MCP} Registering 'get_chrome_activity_log' tool...`)

  server.registerTool(
    'get_chrome_activity_log',
    {
      description: `Retrieves audit logs of Chrome browser activity (e.g., login events, policy violations, extension installs).
Use this for security investigations and auditing user actions within the managed browser environment.`,
      inputSchema: {
        userKey: z.string().describe(`The user key to get activities for. Use "all" for all users.`).default('all'),
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
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
      },
      outputSchema: z
        .object({
          activities: z.array(commonOutputSchemas.activity),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
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
        handler: async (
          { userKey, eventName, startTime, endTime, maxResults, customerId },
          { _requestInfo, authToken },
        ) => {
          logger.debug(
            `${TAGS.MCP} Calling 'get_chrome_activity_log' with userKey: ${userKey}, eventName: ${eventName}, startTime: ${startTime}, endTime: ${endTime}, maxResults: ${maxResults}, customerId: ${customerId}`,
          )
          const activities = await adminSdkClient.listChromeActivities(
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

          return safeFormatResponse({
            rawData: activities,
            toolName: 'get_chrome_activity_log',
            formatFn: data => {
              if (!data || data.length === 0) {
                logger.debug(`${TAGS.MCP} No Chrome activity found.`)
                return formatToolResponse({
                  summary: 'No Chrome activity found for the specified criteria.',
                  data: { activities: [] },
                  structuredContent: { activities: [] },
                })
              }

              const formattedActivities = data
                .map(act => {
                  const time = new Date(act.id.time).toISOString()
                  const user = act.actor?.email || 'Unknown'
                  const eventNames = (act.events || []).map(e => e.name).join(', ')
                  const eventType = act.events?.[0]?.type || 'Unknown'
                  return `- **${time}** — actor: ${user}, events: ${eventNames}, type: ${eventType}`
                })
                .join('\n')

              logger.debug(`${TAGS.MCP} Successfully retrieved Chrome activity log.`)
              return formatToolResponse({
                summary: `## Chrome Activity Log (${data.length} events)\n\n${formattedActivities}`,
                data: { activities: data },
                structuredContent: { activities: data },
              })
            },
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
