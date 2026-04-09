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
 * @fileoverview Tool definition for checking a specific user's CEP license.
 */

import { z } from 'zod'
import { guardedToolCall } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'check_user_cep_license' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/admin_sdk_client.js').AdminSdkClient} options.adminSdkClient - The Admin SDK client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerCheckUserCepLicenseTool(server, options, sessionState) {
  const { adminSdkClient } = options
  logger.debug(`${TAGS.MCP} Registering 'check_user_cep_license' tool...`)

  server.registerTool(
    'check_user_cep_license',
    {
      description: 'Checks if a specific user has a Chrome Enterprise Premium (CEP) license assigned.',
      inputSchema: {
        userId: z.string().describe("The user's primary email address or unique ID."),
      },
    },
    guardedToolCall(
      {
        handler: async ({ userId }, { _requestInfo, authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'check_user_cep_license' for user: ${userId}`)

          const result = await adminSdkClient.checkUserCepLicense(userId, authToken)

          if (result) {
            logger.debug(`${TAGS.MCP} CEP license found for user ${userId}.`)
            return {
              content: [
                {
                  type: 'text',
                  text: `Success: User '${userId}' has a Chrome Enterprise Premium (CEP) license assigned.`,
                },
              ],
              structuredContent: {
                license: result,
              },
            }
          } else {
            logger.debug(`${TAGS.MCP} No CEP license found for user ${userId}.`)
            return {
              content: [
                {
                  type: 'text',
                  text: `User '${userId}' does NOT have a Chrome Enterprise Premium (CEP) license assigned.`,
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
