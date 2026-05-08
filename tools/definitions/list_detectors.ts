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
 * @file Tool definition for listing DLP detectors.
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
import { isObject, getString, getObject, getStringArray } from '../../lib/util/helpers.js'

/**
 * Registers the 'list_detectors' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerListDetectorsTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const cloudIdentityClient = apiClients?.cloudIdentity
  logger.debug(`${TAGS.MCP} Registering 'list_detectors' tool...`)

  server.registerTool(
    'list_detectors',
    {
      description: `Lists all custom Chrome DLP detectors (URL lists, word lists, or regular expressions).
Detectors are used within DLP rules to identify sensitive content. Use this to find the 'policyName' of a detector to include in a rule.`,
      inputSchema: {},
      outputSchema: z
        .object({
          detectors: z.array(commonOutputSchemas.cloudIdentityPolicy),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async (_params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          logger.debug(`${TAGS.MCP} Calling 'list_detectors'`)
          if (!cloudIdentityClient) {
            throw new Error('cloudIdentityClient is required for list_detectors')
          }
          const detectors = await cloudIdentityClient.listDetectors(authToken || '')

          return safeFormatResponse({
            rawData: detectors,
            toolName: 'list_detectors',
            formatFn: (raw: unknown): McpToolResponse => {
              if (!Array.isArray(raw)) {
                throw new Error('list_detectors formatting failed: rawData is not an array')
              }
              if (raw.length === 0) {
                return formatToolResponse({
                  summary: 'No detectors found.',
                  data: { detectors: [] },
                  structuredContent: { detectors: [] },
                })
              }

              const formatType = (s: string | null | undefined): string =>
                String(s || 'Unknown')
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, l => l.toUpperCase())

              const policies = raw.filter(isObject)

              const summaryLines = policies.map(p => {
                const setting = getObject(p, 'setting')
                const settingValue = setting ? getObject(setting, 'value') : null
                const name = getString(p, 'name') || ''
                const displayName =
                  (settingValue && getString(settingValue, 'displayName')) ||
                  getString(p, 'displayName') ||
                  name.split('/').pop() ||
                  'Unnamed Detector'

                const rawType = setting ? getString(setting, 'type') : undefined
                const type = formatType(rawType ? rawType.split('.').pop() : undefined)

                let detail = ''
                if (settingValue) {
                  const urlList = getObject(settingValue, 'url_list')
                  const wordList = getObject(settingValue, 'word_list')
                  const regexList = getObject(settingValue, 'regular_expression')

                  const urls = urlList ? getStringArray(urlList, 'urls') : null
                  const words = wordList ? getStringArray(wordList, 'words') : null
                  const expression = regexList ? getString(regexList, 'expression') : null

                  if (urls) {
                    detail = ` (targeting ${urls.join(', ')})`
                  } else if (words) {
                    detail = ` (targeting words: ${words.join(', ')})`
                  } else if (expression) {
                    detail = ` (pattern: ${expression})`
                  }
                }

                return `- **${displayName}** — Type: ${type}, Resource: \`${name}\`${detail}`
              })

              const resourceMap = policies
                .map(p => {
                  const setting = getObject(p, 'setting')
                  const settingValue = setting ? getObject(setting, 'value') : null
                  const name = getString(p, 'name') || ''
                  const displayName =
                    (settingValue && getString(settingValue, 'displayName')) ||
                    getString(p, 'displayName') ||
                    name.split('/').pop() ||
                    'Unnamed Detector'
                  return `- "${displayName}" → \`${name}\``
                })
                .join('\n')

              const text = `## DLP Detectors (${policies.length})\n\n${summaryLines.join('\n')}\n\nResource names for API operations:\n${resourceMap}`

              return formatToolResponse({
                summary: text,
                data: { detectors: raw },
                structuredContent: { detectors: raw },
              })
            },
          })
        },
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )
}
