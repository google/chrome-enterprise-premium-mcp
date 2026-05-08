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
 * @file Tool definition for retrieving the customer ID.
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

/**
 * Registers the 'get_customer_id' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerGetCustomerIdTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const adminSdkClient = apiClients?.adminSdk
  logger.debug(`${TAGS.MCP} Registering 'get_customer_id' tool...`)

  server.registerTool(
    'get_customer_id',
    {
      description: `Retrieves the unique Google customer ID for the authenticated account.
This ID (often starting with 'C') is required as a parameter for many other Chrome management tools.`,
      inputSchema: {},
      outputSchema: z
        .object({
          customerId: z.string().nullable().describe('The unique customer ID.'),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async (_params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          logger.debug(`${TAGS.MCP} Calling 'get_customer_id'`)
          if (!adminSdkClient) {
            throw new Error('adminSdkClient is required for get_customer_id')
          }
          const customer = await adminSdkClient.getCustomerId(authToken || '')
          logger.debug(`${TAGS.MCP} Raw customer data:`, JSON.stringify(customer, null, 2))

          if (!customer) {
            logger.error(`${TAGS.MCP} get_customer_id tool: Could not retrieve customer ID.`)
            const sc = { customerId: null }
            return formatToolResponse({
              summary: 'Could not retrieve customer ID.',
              data: sc,
              structuredContent: sc,
            })
          }
          logger.debug(`${TAGS.MCP} Successfully retrieved customer ID: ${customer.id}`)
          const sc = { customerId: customer.id, ...customer }
          return formatToolResponse({
            summary: `Customer ID: \`${customer.id || ''}\`

  - domain: ${customer.customerDomain || ''}
  - language: ${customer.language || ''}`,
            data: sc,
            structuredContent: sc,
          })
        },
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )
}
