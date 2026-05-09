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
 * @file Tool definition for checking CEP subscription.
 */

import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

const CheckCepSubscriptionSchema = z.object({
  customerId: z.string().optional(),
})

type CheckCepSubscriptionParams = z.infer<typeof CheckCepSubscriptionSchema>

/**
 * Registers the 'check_cep_subscription' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerCheckCepSubscriptionTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const adminSdkClient = apiClients?.adminSdk
  logger.debug(`${TAGS.MCP} Registering 'check_cep_subscription' tool...`)

  server.registerTool(
    'check_cep_subscription',
    {
      description:
        'Verifies the current Chrome Enterprise Premium (CEP) license assignments for an organization. This is useful for checking the actual protection state of users.',
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
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
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          if (!adminSdkClient) {
            throw new Error('adminSdkClient is required for check_cep_subscription')
          }

          // Strictly parse using Zod
          const safeParams: CheckCepSubscriptionParams = CheckCepSubscriptionSchema.parse(params)
          const { customerId } = safeParams

          logger.debug(`${TAGS.MCP} Calling 'check_cep_subscription' for customer: ${customerId || ''}`)
          const result = await adminSdkClient.checkCepSubscription(customerId || '', authToken || '')

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
