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
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'get_customer_id' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/admin_sdk_client.js').AdminSdkClient} options.adminSdkClient - The Admin SDK client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerGetCustomerIdTool(server, options, sessionState) {
  const { adminSdkClient } = options
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
        /**
         * Handler for retrieving the customer ID.
         * @param {object} params - The tool parameters.
         * @param {object} context - The tool execution context.
         * @param {object} context._requestInfo - The request info object.
         * @param {string} context.authToken - The OAuth2 access token.
         * @returns {Promise<object>} The formatted tool response.
         */
        handler: async (params, { _requestInfo, authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'get_customer_id'`)
          const customer = await adminSdkClient.getCustomerId(authToken)
          logger.debug(`${TAGS.MCP} Raw customer data:`, JSON.stringify(customer, null, 2))

          if (!customer) {
            logger.error(`${TAGS.MCP} ✗ get_customer_id tool: Could not retrieve customer ID.`)
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
            summary: `Customer ID: \`${customer.id}\`

  - domain: ${customer.customerDomain}
  - language: ${customer.language}`,
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
