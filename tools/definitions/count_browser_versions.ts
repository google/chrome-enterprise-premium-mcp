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
 * @file Tool definition for counting browser versions.
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

const CountBrowserVersionsSchema = z.object({
  customerId: z.string().optional(),
  orgUnitId: z.string().optional(),
})

type CountBrowserVersionsParams = z.infer<typeof CountBrowserVersionsSchema>

/**
 * Registers the 'count_browser_versions' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerCountBrowserVersionsTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const chromeManagementClient = apiClients?.chromeManagement
  logger.debug(`${TAGS.MCP} Registering 'count_browser_versions' tool...`)

  server.registerTool(
    'count_browser_versions',
    {
      description: `Counts Chrome browser versions reported by managed devices.
Use this for auditing and reporting on the distribution of browser versions across your organization or a specific Organizational Unit.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
        orgUnitId: z.string().optional().describe('The ID of the organizational unit to filter results.'),
      },
      outputSchema: z
        .object({
          versions: z.array(commonOutputSchemas.browserVersion),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          if (!chromeManagementClient) {
            throw new Error('chromeManagementClient is required for count_browser_versions')
          }

          // Strictly parse using Zod
          const safeParams: CountBrowserVersionsParams = CountBrowserVersionsSchema.parse(params)
          const { customerId, orgUnitId } = safeParams

          logger.debug(
            `${TAGS.MCP} Calling 'count_browser_versions' with customerId: ${customerId || ''}, orgUnitId: ${orgUnitId || ''}`,
          )
          const versions = await chromeManagementClient.countBrowserVersions(
            customerId || '',
            orgUnitId || undefined,
            authToken || '',
          )

          return safeFormatResponse({
            rawData: versions,
            toolName: 'count_browser_versions',
            formatFn: (raw: unknown): McpToolResponse => {
              if (!Array.isArray(raw)) {
                const sc = { versions: [] }
                return formatToolResponse({
                  summary: `No browser versions found for customer ${customerId || ''}.`,
                  data: sc,
                  structuredContent: sc,
                })
              }

              const items = raw.filter(isObject)
              const coerced = items.map(v => {
                const countStr = getString(v, 'count')
                return {
                  version: getString(v, 'version') || '',
                  count: countStr ? Number(countStr) : 0,
                  channel: getString(v, 'channel') || 'UNKNOWN',
                }
              })

              if (coerced.length === 0) {
                const sc = { versions: [] }
                return formatToolResponse({
                  summary: `No browser versions found for customer ${customerId || ''}.`,
                  data: sc,
                  structuredContent: sc,
                })
              }

              const versionList = coerced
                .map(v => `- **${v.version}** — count: ${v.count}, channel: ${v.channel}`)
                .join('\n')

              const sc = { versions: coerced }
              return formatToolResponse({
                summary: `## Browser Versions (${coerced.length})\n\n${versionList}`,
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
