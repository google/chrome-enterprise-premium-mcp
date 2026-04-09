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
 * @fileoverview Tool definition for listing customer profiles.
 */

import { z } from 'zod'
import { guardedToolCall } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'list_customer_profiles' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_management_client.js').ChromeManagementClient} options.chromeManagementClient - The Chrome Management client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerCustomerProfileTool(server, options, sessionState) {
  const { chromeManagementClient } = options
  logger.debug(`${TAGS.MCP} Registering 'list_customer_profiles' tool...`)

  server.registerTool(
    'list_customer_profiles',
    {
      description: 'Lists all customer profiles for a given customer.',
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
      },
    },
    guardedToolCall(
      {
        handler: async ({ customerId }, { _requestInfo, authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'list_customer_profiles' with customerId: ${customerId}`)
          try {
            const profiles = await chromeManagementClient.listCustomerProfiles(customerId, authToken)

            if (!profiles || profiles.length === 0) {
              logger.debug(`${TAGS.MCP} No profiles found.`)
              return {
                content: [
                  {
                    type: 'text',
                    text: `No profiles found for customer ${customerId}.`,
                  },
                ],
                structuredContent: { profiles: [] },
              }
            }

            const formattedProfiles = profiles
              .map(profile => {
                const displayName = profile.displayName || 'Unnamed Profile'
                const id =
                  profile.profileId || profile.profilePermanentId || profile.name?.split('/').pop() || 'Unknown'
                return `*   **Name:** ${displayName}\n    *   **ID:** \`${id}\``
              })
              .join('\n')

            const resourceMap = profiles
              .map(profile => {
                const displayName = profile.displayName || 'Unnamed Profile'
                return `- "${displayName}" → ${profile.name}`
              })
              .join('\n')

            logger.debug(`${TAGS.MCP} Successfully listed customer profiles.`)
            return {
              content: [
                {
                  type: 'text',
                  text: `# Customer Profiles for ${customerId}\n\n${formattedProfiles}`,
                },
                {
                  type: 'text',
                  text: `Resource names for API operations:\n${resourceMap}`,
                },
              ],
              structuredContent: { profiles },
            }
          } catch (error) {
            logger.error(`${TAGS.MCP} Error listing customer profiles: ${error.message}`)
            return {
              content: [{ type: 'text', text: `Error listing customer profiles: ${error.message}` }],
            }
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
