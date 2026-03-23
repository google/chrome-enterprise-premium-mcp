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

import { guardedToolCall, inputSchemas, getAuthToken } from '../utils.js'
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
      description: 'Checks if the customer has an active Chrome Enterprise Premium (CEP) subscription.',
      inputSchema: {
        customerId: inputSchemas.customerId,
      },
    },
    guardedToolCall(
      {
        handler: async ({ customerId }, { requestInfo }) => {
          logger.debug(`${TAGS.MCP} Calling 'check_cep_subscription' for customer: ${customerId}`)
          const authToken = getAuthToken(requestInfo)

          const result = await adminSdkClient.checkCepSubscription(customerId, authToken)

          const assignments = result?.items || []
          if (assignments.length > 0) {
            logger.debug(`${TAGS.MCP} CEP subscription found for customer ${customerId}.`)
            return {
              content: [
                {
                  type: 'text',
                  text: `Success: Found ${assignments.length} Chrome Enterprise Premium (CEP) license assignment(s). The subscription is active.`,
                },
              ],
            }
          } else {
            logger.debug(`${TAGS.MCP} No CEP subscription found for customer ${customerId}.`)
            return {
              content: [
                {
                  type: 'text',
                  text: `No Chrome Enterprise Premium (CEP) license assignments found. Note that the customer might have a CEP subscription, but no licenses have been assigned yet.`,
                },
              ],
            }
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
