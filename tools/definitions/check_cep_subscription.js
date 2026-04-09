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
 * @fileoverview Tool definition for checking CEP subscription.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'check_cep_subscription' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/admin_sdk_client.js').AdminSdkClient} options.adminSdkClient - The Admin SDK client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerCheckCepSubscriptionTool(server, options, sessionState) {
  const { adminSdkClient } = options
  logger.debug(`${TAGS.MCP} Registering 'check_cep_subscription' tool...`)

  server.registerTool(
    'check_cep_subscription',
    {
      description:
        'Verifies the current Chrome Enterprise Premium (CEP) license assignments for an organization. This is useful for checking the actual protection state of users.',
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
      },
      outputSchema: z
        .object({
          isActive: z.boolean(),
          assignmentCount: z.number(),
          assignments: z.array(z.object({}).passthrough()).optional(),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async ({ customerId }, { _requestInfo, authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'check_cep_subscription' for customer: ${customerId}`)

          const result = await adminSdkClient.checkCepSubscription(customerId, authToken)

          const assignments = result?.items || []
          if (assignments.length > 0) {
            return formatToolResponse({
              summary: `Chrome Enterprise Premium subscription is active. ${assignments.length} license assignment(s) found.`,
              data: { isActive: true, assignmentCount: assignments.length, assignments },
              structuredContent: { isActive: true, assignmentCount: assignments.length, assignments },
            })
          } else {
            return formatToolResponse({
              summary: `No Chrome Enterprise Premium license assignments found. The customer may have a subscription but no licenses assigned yet.`,
              data: { isActive: false, assignmentCount: 0, assignments: [] },
              structuredContent: { isActive: false, assignmentCount: 0, assignments: [] },
            })
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
