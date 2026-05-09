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
*/ /*
Copyright 2026 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
Soyou may obtain a copy of the License at

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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  safeFormatResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { isObject, getString } from '../../lib/util/helpers.js'

const ListCustomerProfilesSchema = z.object({
  customerId: z.string().optional(),
})

type ListCustomerProfilesParams = z.infer<typeof ListCustomerProfilesSchema>

/**
 * Registers the 'list_customer_profiles' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerCustomerProfileTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const chromeManagementClient = apiClients?.chromeManagement
  logger.debug(`${TAGS.MCP} Registering 'list_customer_profiles' tool...`)

  server.registerTool(
    'list_customer_profiles',
    {
      description: `Lists Chrome browser profiles for the customer.
These profiles represent managed browser instances and provide details like OS version, platform, and associated user email.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
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
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          if (!chromeManagementClient) {
            throw new Error('chromeManagementClient is required for list_customer_profiles')
          }

          // Strictly parse using Zod
          const safeParams: ListCustomerProfilesParams = ListCustomerProfilesSchema.parse(params)
          const { customerId } = safeParams

          logger.debug(`${TAGS.MCP} Calling 'list_customer_profiles' with customerId: ${customerId || ''}`)
          const profiles = await chromeManagementClient.listCustomerProfiles(customerId || '', authToken || '')

          return safeFormatResponse({
            rawData: profiles,
            toolName: 'list_customer_profiles',
            formatFn: (data: unknown): McpToolResponse => {
              if (!Array.isArray(data)) {
                logger.debug(`${TAGS.MCP} No profiles found.`)
                const sc = { profiles: [], totalCount: 0 }
                return formatToolResponse({
                  summary: `No profiles found for customer ${customerId || ''}.`,
                  data: sc,
                  structuredContent: sc,
                })
              }

              const items = data.filter(isObject)
              if (items.length === 0) {
                logger.debug(`${TAGS.MCP} No profiles found.`)
                const sc = { profiles: [], totalCount: 0 }
                return formatToolResponse({
                  summary: `No profiles found for customer ${customerId || ''}.`,
                  data: sc,
                  structuredContent: sc,
                })
              }

              const formattedProfiles = items
                .map(profile => {
                  const displayName = getString(profile, 'displayName') || 'Unnamed Profile'
                  const name = getString(profile, 'name') || ''
                  const profileId = getString(profile, 'profileId') || getString(profile, 'profilePermanentId')
                  const id = profileId || name.split('/').pop() || 'Unknown'
                  const email = getString(profile, 'userEmail') || 'Unknown'
                  const osPlatform = getString(profile, 'osPlatformType')
                  const os = osPlatform ? `${osPlatform} ${getString(profile, 'osVersion') || ''}` : 'Unknown'
                  return `- **${displayName}** — Email: ${email}, OS: ${os}, Profile: \`${id}\``
                })
                .join('\n')

              const resourceMap = items
                .map(profile => {
                  const displayName = getString(profile, 'displayName') || 'Unnamed Profile'
                  const name = getString(profile, 'name') || ''
                  return `- "${displayName}" → \`${name}\``
                })
                .join('\n')

              logger.debug(`${TAGS.MCP} Successfully listed customer profiles.`)
              const text = `## Browser Profiles (${items.length})\n\n${formattedProfiles}\n\nResource names for API operations:\n${resourceMap}`

              const sc = { profiles: items, totalCount: items.length }
              return formatToolResponse({
                summary: text,
                data: sc,
                structuredContent: sc,
              })
            },
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
