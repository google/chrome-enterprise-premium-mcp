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
 * @fileoverview Tool definition for retrieving the customer ID.
 */

import { guardedToolCall } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { z } from 'zod'

/**
 * Registers the 'get_customer_id' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/admin_sdk_client.js').AdminSdkClient} options.adminSdkClient - The Admin SDK client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerGetCustomerIdTool(server, options, sessionState) {
  const { adminSdkClient } = options
  logger.debug(`${TAGS.MCP} Registering 'get_customer_id' tool...`)

  server.registerTool(
    'get_customer_id',
    {
      description: `Gets the customer ID for the authenticated user. All other tools that require a customer ID should get it using this tool instead of asking the user for it.`,
      inputSchema: {},
      outputSchema: z
        .object({
          customerId: z.string().nullable().describe('The unique customer ID.'),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async (params, { _requestInfo, authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'get_customer_id'`)
          const customer = await adminSdkClient.getCustomerId(authToken)

          if (!customer) {
            logger.error(`${TAGS.MCP} ✗ get_customer_id tool: Could not retrieve customer ID. Response:`, customer)
            return {
              content: [{ type: 'text', text: 'Could not retrieve customer ID.' }],
            }
          }
          logger.debug(`${TAGS.MCP} Successfully retrieved customer ID.`)
          return {
            content: [{ type: 'text', text: `✅ **Customer ID:** \`${customer.id}\`` }],
            structuredContent: { customerId: customer.id, ...customer },
          }
        },
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )
}
