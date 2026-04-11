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
 * @file Tool definition for listing customer profiles.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'list_customer_profiles' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_management_client.js').ChromeManagementClient} options.chromeManagementClient - The Chrome Management client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerCustomerProfileTool(server, options, sessionState) {
  const { chromeManagementClient } = options
  logger.debug(`${TAGS.MCP} Registering 'list_customer_profiles' tool...`)

  server.registerTool(
    'list_customer_profiles',
    {
      description: `Lists Chrome browser profiles for the customer.
These profiles represent managed browser instances and provide details like OS version, platform, and associated user email.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
      },
      outputSchema: z
        .object({
          profiles: z.array(commonOutputSchemas.browserProfile),
          totalCount: z.number(),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        /**
         * Handler for listing customer browser profiles.
         * @param {object} params - The tool parameters.
         * @param {string} [params.customerId] - The Chrome customer ID.
         * @param {object} context - The tool execution context.
         * @param {object} context._requestInfo - The request info object.
         * @param {string} context.authToken - The OAuth2 access token.
         * @returns {Promise<object>} The formatted tool response.
         */
        handler: async ({ customerId }, { _requestInfo, authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'list_customer_profiles' with customerId: ${customerId}`)
          try {
            const profiles = await chromeManagementClient.listCustomerProfiles(customerId, authToken)

            if (!profiles || profiles.length === 0) {
              logger.debug(`${TAGS.MCP} No profiles found.`)
              const sc = { profiles: [], totalCount: 0 }
              return formatToolResponse({
                summary: `No profiles found for customer ${customerId}.`,
                data: sc,
                structuredContent: sc,
              })
            }

            const formattedProfiles = profiles
              .map(profile => {
                const displayName = profile.displayName || 'Unnamed Profile'
                const id =
                  profile.profileId || profile.profilePermanentId || profile.name?.split('/').pop() || 'Unknown'
                const email = profile.userEmail || 'Unknown'
                const os = profile.osPlatformType ? `${profile.osPlatformType} ${profile.osVersion || ''}` : 'Unknown'
                return `- **${displayName}** — Email: ${email}, OS: ${os}, Profile: \`${id}\``
              })
              .join('\n')

            const resourceMap = profiles
              .map(profile => {
                const displayName = profile.displayName || 'Unnamed Profile'
                return `- "${displayName}" → \`${profile.name}\``
              })
              .join('\n')

            logger.debug(`${TAGS.MCP} Successfully listed customer profiles.`)
            const text = `## Browser Profiles (${profiles.length})\n\n${formattedProfiles}\n\nResource names for API operations:\n${resourceMap}`

            const sc = { profiles, totalCount: profiles.length }
            return formatToolResponse({
              summary: text,
              data: sc,
              structuredContent: sc,
            })
          } catch (error) {
            logger.error(`${TAGS.MCP} Error listing customer profiles: ${error.message}`)
            const sc = { profiles: [], totalCount: 0, error: true, message: error.message }
            return formatToolResponse({
              summary: `Error listing customer profiles: ${error.message}`,
              data: sc,
              structuredContent: sc,
            })
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
