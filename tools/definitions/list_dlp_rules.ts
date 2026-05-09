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
 * @file Tool definition for listing Chrome DLP rules.
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
import { parseDlpRule, isObject } from '../../lib/util/helpers.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'list_dlp_rules' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerListDlpRulesTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const cloudIdentityClient = apiClients?.cloudIdentity
  logger.debug(`${TAGS.MCP} Registering 'list_dlp_rules' tool...`)

  server.registerTool(
    'list_dlp_rules',
    {
      description:
        'Lists all Chrome DLP rules currently configured in the organization. These rules protect sensitive data by monitoring browser actions like uploads, printing, and screenshots.',
      inputSchema: {},
      outputSchema: z
        .object({
          dlpRules: z.array(commonOutputSchemas.cloudIdentityPolicy),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async (_params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          logger.debug(`${TAGS.MCP} Calling 'list_dlp_rules'`)
          if (!cloudIdentityClient) {
            throw new Error('cloudIdentityClient is required for list_dlp_rules')
          }
          const policies = await cloudIdentityClient.listDlpRules(authToken || '')

          return safeFormatResponse({
            rawData: policies,
            toolName: 'list_dlp_rules',
            formatFn: (data: unknown): McpToolResponse => {
              if (!Array.isArray(data)) {
                throw new Error('list_dlp_rules formatting failed: rawData is not an array')
              }
              if (data.length === 0) {
                return formatToolResponse({
                  summary: 'No Chrome DLP rules were found in this organization.',
                  data: { dlpRules: [] },
                  structuredContent: { dlpRules: [] },
                })
              }

              const policiesObj = data.filter(isObject)
              const ruleEntries = policiesObj.map(parseDlpRule)

              const summaryLines = ruleEntries.map(
                r =>
                  `- **${r.name}** — status: ${r.status}, action: ${r.action}, triggers: ${r.triggers}, condition: \`${r.condition}\``,
              )

              const resourceMap = ruleEntries.map(r => `- "${r.name}" → \`${r.resourceName}\``).join('\n')

              return formatToolResponse({
                summary: `## DLP Rules (${ruleEntries.length})\n\n${summaryLines.join('\n')}\n\nResource names for API operations:\n${resourceMap}`,
                data: { dlpRules: data },
                structuredContent: { dlpRules: data },
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
