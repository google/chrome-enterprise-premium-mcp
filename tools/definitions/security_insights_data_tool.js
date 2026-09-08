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
 * @file Tool definition for querying Chrome Security Insights data.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse, safeFormatResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'security_insights_data' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/chrome_management_client.js').ChromeManagementClient} options.chromeManagementClient - The Chrome Management client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerSecurityInsightsDataTool(server, options, sessionState) {
  const { chromeManagementClient } = options
  logger.debug(`${TAGS.MCP} Registering 'security_insights_data' tool...`)

  server.registerTool(
    'security_insights_data',
    {
      description: `Queries Chrome Enterprise Security Insights data.
Allows retrieving summaries and breakdowns of content transfers (uploads, downloads, prints) and URL visits.
Supports filtering by event time, user, domain, or content category depending on the query action.`,
      inputSchema: z.object({
        action: z
          .enum([
            'queryContentTransfers',
            'queryContentTransfersBreakdowns',
            'queryUrlVisits',
            'queryUrlVisitsBreakdowns',
          ])
          .describe('The query action to perform.'),
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345). Defaults to "my_customer".'),
        filter: z
          .string()
          .optional()
          .describe(
            'AIP-160 filter string. E.g., for transfers: `event_time >= "2024-01-01T00:00:00Z" AND event_time <= "2024-01-02T00:00:00Z"`. For breakdowns: `user = "testuser" AND event_time <= "2024-01-02T00:00:00Z"`.',
          ),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('Maximum number of breakdowns to return (default 50, max 1000). Only for breakdown actions.'),
        pageToken: z
          .string()
          .optional()
          .describe('Page token received from a previous breakdown call to retrieve the next page.'),
        metric: z
          .string()
          .optional()
          .describe(
            'The metric to return breakdowns for. E.g., for transfers: CONTENT_TRANSFERS_METRIC_TOTAL_TRANSFERS, CONTENT_TRANSFERS_METRIC_TOTAL_SENSITIVE_TRANSFERS, etc. For URL visits: URL_VISITS_METRIC_TOTAL_SUSPICIOUS_URL_VISITS, etc.',
          ),
        breakdown: z
          .string()
          .optional()
          .describe(
            'The dimension to break down by. For transfers: USER, EVENT_DOMAIN, CONTENT_CATEGORY. For URL visits: USER, EVENT_DOMAIN.',
          ),
        fixedTimeRange: z
          .enum([
            'FIXED_TIME_RANGE_UNSPECIFIED',
            'FIXED_TIME_RANGE_FOUR_HOURS',
            'FIXED_TIME_RANGE_ONE_DAY',
            'FIXED_TIME_RANGE_ONE_WEEK',
            'FIXED_TIME_RANGE_FOUR_WEEKS',
          ])
          .optional()
          .describe(
            'Fixed time range for precomputed breakdowns (default: FIXED_TIME_RANGE_FOUR_WEEKS). Only for breakdown actions.',
          ),
      }),
      outputSchema: z.looseObject({}),
    },
    guardedToolCall(
      {
        handler: async (
          { action, customerId = 'my_customer', filter, pageSize, pageToken, metric, breakdown, fixedTimeRange },
          { _requestInfo, authToken },
        ) => {
          logger.debug(`${TAGS.MCP} Calling 'security_insights_data' with action: ${action}, customerId: ${customerId}`)

          const queryOptions = {}
          if (filter !== undefined) {
            queryOptions.filter = filter
          }

          if (action.endsWith('Breakdowns')) {
            if (pageSize !== undefined) {
              queryOptions.pageSize = pageSize
            }
            if (pageToken !== undefined) {
              queryOptions.pageToken = pageToken
            }
            if (metric !== undefined) {
              queryOptions.metric = metric
            }
            if (breakdown !== undefined) {
              queryOptions.breakdown = breakdown
            }
            if (fixedTimeRange !== undefined) {
              queryOptions.fixedTimeRange = fixedTimeRange
            }
          }

          let result
          if (action === 'queryContentTransfers') {
            result = await chromeManagementClient.queryContentTransfers(customerId, queryOptions, authToken)
          } else if (action === 'queryContentTransfersBreakdowns') {
            result = await chromeManagementClient.queryContentTransfersBreakdowns(customerId, queryOptions, authToken)
          } else if (action === 'queryUrlVisits') {
            result = await chromeManagementClient.queryUrlVisits(customerId, queryOptions, authToken)
          } else if (action === 'queryUrlVisitsBreakdowns') {
            result = await chromeManagementClient.queryUrlVisitsBreakdowns(customerId, queryOptions, authToken)
          }

          return safeFormatResponse({
            rawData: result,
            toolName: 'security_insights_data',
            formatFn: raw => {
              let summaryText = `Security Insights action \`${action}\` completed.`
              if (action === 'queryContentTransfers' || action === 'queryUrlVisits') {
                const summaries = raw?.summaries || []
                summaryText += ` Found ${summaries.length} summaries.`
              } else {
                const breakdowns =
                  action === 'queryContentTransfersBreakdowns'
                    ? raw?.contentTransfersBreakdowns || []
                    : raw?.urlVisitsBreakdowns || []
                summaryText += ` Found ${breakdowns.length} breakdowns.`
              }

              return formatToolResponse({
                summary: summaryText,
                data: raw,
                structuredContent: raw,
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
