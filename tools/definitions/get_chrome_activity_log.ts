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
 * @file Tool definition for getting the Chrome activity log.
 */

import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  safeFormatResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { isObject, getString, getObject } from '../../lib/util/helpers.js'

const GetChromeActivityLogSchema = z.object({
  userKey: z.string().default('all'),
  eventName: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  maxResults: z.number().optional(),
  customerId: z.string().optional(),
})

type GetChromeActivityLogParams = z.infer<typeof GetChromeActivityLogSchema>

/**
 * Registers the 'get_chrome_activity_log' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerGetChromeActivityLogTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const adminSdkClient = apiClients?.adminSdk
  logger.debug(`${TAGS.MCP} Registering 'get_chrome_activity_log' tool...`)

  server.registerTool(
    'get_chrome_activity_log',
    {
      description: `Retrieves audit logs of Chrome browser activity (e.g., login events, policy violations, extension installs).
Use this for security investigations, auditing user actions, and to help tune DLP rules.`,
      inputSchema: {
        userKey: z.string().describe('The user key to get activities for. Use "all" for all users.').default('all'),
        eventName: z.string().optional().describe('The name of the event to filter by.'),
        startTime: z
          .string()
          .optional()
          .describe(
            'The start time of the range to get activities for (RFC3339 timestamp). Defaults to 10 days ago if not specified.',
          ),
        endTime: z
          .string()
          .optional()
          .describe('The end time of the range to get activities for (RFC3339 timestamp). Defaults to now.'),
        maxResults: z.number().optional().describe('The maximum number of results to return.'),
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
      },
      outputSchema: z
        .object({
          activities: z.array(commonOutputSchemas.activity),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        transform: (params: Record<string, unknown>): Record<string, unknown> => {
          const newParams = { ...params }
          if (!getString(newParams, 'startTime')) {
            const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
            newParams.startTime = tenDaysAgo.toISOString()
          }
          if (!getString(newParams, 'endTime')) {
            newParams.endTime = new Date().toISOString()
          }
          return newParams
        },
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          if (!adminSdkClient) {
            throw new Error('adminSdkClient is required for get_chrome_activity_log')
          }

          // Strictly parse using Zod
          const safeParams: GetChromeActivityLogParams = GetChromeActivityLogSchema.parse(params)
          const { userKey, eventName, startTime, endTime, maxResults, customerId } = safeParams

          logger.debug(
            `${TAGS.MCP} Calling 'get_chrome_activity_log' with userKey: ${userKey}, eventName: ${eventName || ''}, startTime: ${startTime || ''}, endTime: ${endTime || ''}, maxResults: ${String(maxResults)}, customerId: ${customerId || ''}`,
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
            authToken || '',
          )

          return safeFormatResponse({
            rawData: activities,
            toolName: 'get_chrome_activity_log',
            formatFn: (data: unknown): McpToolResponse => {
              if (!Array.isArray(data)) {
                logger.debug(`${TAGS.MCP} No Chrome activity found.`)
                return formatToolResponse({
                  summary: 'No Chrome activity found for the specified criteria.',
                  data: { activities: [] },
                  structuredContent: { activities: [] },
                })
              }

              const items = data.filter(isObject)
              if (items.length === 0) {
                logger.debug(`${TAGS.MCP} No Chrome activity found.`)
                return formatToolResponse({
                  summary: 'No Chrome activity found for the specified criteria.',
                  data: { activities: [] },
                  structuredContent: { activities: [] },
                })
              }

              const formattedActivities = items
                .map(act => {
                  const actId = getObject(act, 'id')
                  const actor = getObject(act, 'actor')
                  const events = act.events
                  const actEvents = Array.isArray(events) ? events.filter(isObject) : []

                  const timeStr = actId ? getString(actId, 'time') : null
                  const time = timeStr ? new Date(timeStr).toISOString() : 'Unknown'
                  const user = (actor && getString(actor, 'email')) || 'Unknown'
                  const eventNames = actEvents
                    .map(e => getString(e, 'name') || '')
                    .filter(Boolean)
                    .join(', ')
                  const eventType = (actEvents.length > 0 && getString(actEvents[0], 'type')) || 'Unknown'
                  return `- **${time}** — actor: ${user}, events: ${eventNames || 'none'}, type: ${eventType}`
                })
                .join('\n')

              logger.debug(`${TAGS.MCP} Successfully retrieved Chrome activity log.`)
              return formatToolResponse({
                summary: `## Chrome Activity Log (${items.length} events)\n\n${formattedActivities}`,
                data: { activities: items },
                structuredContent: { activities: items },
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
