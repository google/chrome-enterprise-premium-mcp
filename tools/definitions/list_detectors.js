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

import { z } from 'zod'
import { guardedToolCall, formatToolResponse, safeFormatResponse } from '../utils/wrapper.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'list_detectors' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerListDetectorsTool(server, options, sessionState) {
  const { cloudIdentityClient } = options
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
        handler: async (_, { authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'list_detectors'`)
          const detectors = await cloudIdentityClient.listDetectors(authToken)

          return safeFormatResponse({
            rawData: detectors,
            toolName: 'list_detectors',
            formatFn: raw => {
              if (!raw || raw.length === 0) {
                return formatToolResponse({
                  summary: 'No detectors found.',
                  data: { detectors: [] },
                  structuredContent: { detectors: [] },
                })
              }

              /**
               * Formats the detector type for display.
               * @param {string} s - The raw type string.
               * @returns {string} The formatted type string.
               */
              const formatType = s =>
                String(s || 'Unknown')
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, l => l.toUpperCase())

              const summaryLines = raw.map(p => {
                const settingValue = p.setting?.value || {}
                const displayName =
                  settingValue.displayName || p.displayName || p.name?.split('/').pop() || 'Unnamed Detector'
                const type = formatType(p.setting?.type?.split('.').pop())

                let detail = ''
                if (settingValue.url_list?.urls) {
                  detail = ` (targeting ${settingValue.url_list.urls.join(', ')})`
                } else if (settingValue.word_list?.words) {
                  detail = ` (targeting words: ${settingValue.word_list.words.join(', ')})`
                } else if (settingValue.regular_expression?.expression) {
                  detail = ` (pattern: ${settingValue.regular_expression.expression})`
                }

                return `- **${displayName}** — Type: ${type}, Resource: \`${p.name}\`${detail}`
              })

              const resourceMap = raw
                .map(p => {
                  const displayName =
                    p.setting?.value?.displayName || p.displayName || p.name?.split('/').pop() || 'Unnamed Detector'
                  return `- "${displayName}" → \`${p.name}\``
                })
                .join('\n')

              const text = `## DLP Detectors (${raw.length})\n\n${summaryLines.join('\n')}\n\nResource names for API operations:\n${resourceMap}`

              return formatToolResponse({
                summary: text,
                data: { detectors: raw },
                structuredContent: { detectors: raw },
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
