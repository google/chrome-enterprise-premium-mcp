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
 * @fileoverview Tool definition for deleting DLP rules.
 */

import { z } from 'zod'
import { guardedToolCall, getAuthToken, outputSchemas } from '../utils.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'delete_dlp_rule' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 */
export function registerDeleteDlpRuleTool(server, options) {
  const { cloudIdentityClient } = options
  logger.debug(`${TAGS.MCP} Registering 'delete_dlp_rule' tool...`)

  server.registerTool(
    'delete_dlp_rule',
    {
      description: 'Deletes a Chrome DLP rule.',
      inputSchema: {
        policyName: z.string().describe('The name of the DLP rule policy to delete (e.g. policies/abc-123)'),
      },
      outputSchema: outputSchemas.successMessage,
    },
    guardedToolCall(
      {
        handler: async ({ policyName }, { requestInfo }) => {
          logger.debug(`${TAGS.MCP} Calling 'delete_dlp_rule' with policyName: ${policyName}`)
          const authToken = getAuthToken(requestInfo)
          await cloudIdentityClient.deleteDlpRule(policyName, authToken)

          logger.debug(`${TAGS.MCP} Successfully deleted DLP rule.`)
          return {
            content: [
              {
                type: 'text',
                text: `Successfully deleted DLP rule: ${policyName}`,
              },
            ],
          }
        },
      },
      options,
    ),
  )
}
