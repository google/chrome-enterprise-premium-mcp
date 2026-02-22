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
 * @fileoverview Tool definition for counting browser versions.
 */

import { guardedToolCall, inputSchemas, getAuthToken } from '../utils.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'count_browser_versions' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_management_client.js').ChromeManagementClient} options.chromeManagementClient - The Chrome Management client instance.
 */
export function registerCountBrowserVersionsTool(server, options) {
  const { chromeManagementClient } = options
  logger.debug(`${TAGS.MCP} Registering 'count_browser_versions' tool...`)

  server.registerTool(
    'count_browser_versions',
    {
      description: 'Counts Chrome browser versions reported by devices.',
      inputSchema: {
        customerId: inputSchemas.customerId,
        orgUnitId: inputSchemas.orgUnitIdOptional,
      },
    },
    guardedToolCall(
      {
        handler: async ({ customerId, orgUnitId }, { requestInfo }) => {
          logger.debug(
            `${TAGS.MCP} Calling 'count_browser_versions' with customerId: ${customerId}, orgUnitId: ${orgUnitId}`,
          )
          const authToken = getAuthToken(requestInfo)
          const versions = await chromeManagementClient.countBrowserVersions(customerId, orgUnitId, authToken)

          if (!versions || versions.length === 0) {
            logger.debug(`${TAGS.MCP} No browser versions found.`)
            return {
              content: [
                {
                  type: 'text',
                  text: `No browser versions found for customer ${customerId}.`,
                },
              ],
            }
          }

          const versionList = versions
            .map(v => `- ${v.version} (${v.count} devices) - ${v.channel || 'UNKNOWN'}`) // Added fallback for channel
            .join('\n')

          logger.debug(`${TAGS.MCP} Successfully counted browser versions.`)
          return {
            content: [
              {
                type: 'text',
                text: `Browser versions for customer ${customerId}:\n${versionList}`,
              },
            ],
          }
        },
      },
      options.apiOptions,
    ),
  )
}
