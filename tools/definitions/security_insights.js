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
 * @file Tool definition for managing Chrome Security Insights.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse, safeFormatResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'security_insights' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/chrome_management_client.js').ChromeManagementClient} options.chromeManagementClient - The Chrome Management client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerSecurityInsightsTool(server, options, sessionState) {
  const { chromeManagementClient } = options
  logger.debug(`${TAGS.MCP} Registering 'security_insights' tool...`)

  server.registerTool(
    'security_insights',
    {
      description: `Manages the enablement status of Chrome Security Insights for a customer.
Use this to check, enable, or disable the security insights feature customer-wide.`,
      inputSchema: {
        action: z
          .enum(['check', 'enable', 'disable'])
          .describe('The action to perform: check status, enable insights, or disable insights.'),
        targetOus: z
          .array(z.string())
          .optional()
          .describe(
            'Optional Organizational Unit paths relative to root (e.g. ["/corp/sales"]) to set up Chrome connectors for. Only applicable when action is "enable". Defaults to root OU if omitted.',
          ),
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345). Defaults to "my_customer".'),
      },
      outputSchema: z.looseObject({
        insightsState: z.enum(['INSIGHTS_ENABLEMENT_STATE_UNSPECIFIED', 'INSIGHTS_ENABLED', 'INSIGHTS_DISABLED']),
      }),
    },
    guardedToolCall(
      {
        isMutating: false,
        handler: async ({ action, targetOus, customerId = 'my_customer' }, { _requestInfo, authToken }) => {
          logger.debug(
            `${TAGS.MCP} Calling 'security_insights' with action: ${action}, targetOus: ${targetOus}, customerId: ${customerId}`,
          )

          let result
          if (action === 'check') {
            result = await chromeManagementClient.checkSecurityInsightsStatus(customerId, authToken)
          } else if (action === 'enable') {
            result = await chromeManagementClient.enableSecurityInsights(customerId, targetOus, authToken)
          } else if (action === 'disable') {
            result = await chromeManagementClient.disableSecurityInsights(customerId, authToken)
          }

          return safeFormatResponse({
            rawData: result,
            toolName: 'security_insights',
            formatFn: raw => {
              const state = raw?.insightsState || 'INSIGHTS_ENABLEMENT_STATE_UNSPECIFIED'
              const sc = { insightsState: state }
              const summaryText =
                action === 'check'
                  ? `Chrome Security Insights status is: \`${state}\``
                  : `Chrome Security Insights status is now: \`${state}\``
              return formatToolResponse({
                summary: summaryText,
                data: sc,
                structuredContent: sc,
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
