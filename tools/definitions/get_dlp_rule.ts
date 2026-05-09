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
 * @file Tool definition for getting a specific Chrome DLP rule.
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
import { parseDlpRule, isObject, getString } from '../../lib/util/helpers.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'get_dlp_rule' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerGetDlpRuleTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const cloudIdentityClient = apiClients?.cloudIdentity
  logger.debug(`${TAGS.MCP} Registering 'get_dlp_rule' tool...`)

  server.registerTool(
    'get_dlp_rule',
    {
      description:
        'Retrieves details for a specific Chrome DLP rule by its resource name. The response includes a direct link to the Admin Console where you can view, edit, disable, or delete the rule. Note: The agent itself cannot modify or delete rules.',
      inputSchema: {
        resourceName: z.string().describe('The full resource name of the rule (e.g., policies/akajj264apk5psphei).'),
      },
      outputSchema: z
        .object({
          dlpRule: commonOutputSchemas.cloudIdentityPolicy,
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async ({ resourceName }, { authToken }): Promise<McpToolResponse> => {
          logger.debug(`${TAGS.MCP} Calling 'get_dlp_rule' for ${String(resourceName)}`)
          if (!cloudIdentityClient) {
            throw new Error('cloudIdentityClient is required for get_dlp_rule')
          }
          if (typeof resourceName !== 'string') {
            throw new Error('resourceName must be a string')
          }
          const policy = await cloudIdentityClient.getDlpRule(resourceName, authToken || '')

          return safeFormatResponse({
            rawData: policy,
            toolName: 'get_dlp_rule',
            formatFn: (data: unknown): McpToolResponse => {
              if (!isObject(data)) {
                throw new Error('get_dlp_rule formatting failed: rawData is not a valid object')
              }
              const rule = parseDlpRule(data)
              const name = getString(data, 'name') || ''
              const uiLink = `https://admin.google.com/ac/dp/rules/${encodeURIComponent(name)}`

              const summary = `## DLP Rule: ${rule.name}
- **Status**: ${rule.status}
- **Action**: ${rule.action}
- **Triggers**: ${rule.triggers}
- **Condition**: \`${rule.condition}\`
- **Resource Name**: \`${name}\`

💡 To **disable** or **delete** this rule, manage it in the Admin Console: [Manage in UI](${uiLink})`

              return formatToolResponse({
                summary,
                data: { dlpRule: { ...data, uiLink } },
                structuredContent: { dlpRule: { ...data, uiLink } },
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
