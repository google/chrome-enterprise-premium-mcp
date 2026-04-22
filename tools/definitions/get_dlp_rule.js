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
import { guardedToolCall, formatToolResponse, safeFormatResponse, formatStatus } from '../utils/wrapper.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { CHROME_ACTION_TYPES } from '../../lib/util/chrome_dlp_constants.js'

/**
 * Registers the 'get_dlp_rule' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerGetDlpRuleTool(server, options, sessionState) {
  const { cloudIdentityClient } = options
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
        /**
         * Handler for getting a DLP rule.
         * @param {object} params - The tool parameters.
         * @param {string} params.resourceName - The resource name.
         * @param {object} context - The tool execution context.
         * @param {string} context.authToken - The OAuth2 access token.
         * @returns {Promise<object>} The formatted tool response.
         */
        handler: async ({ resourceName }, { authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'get_dlp_rule' for ${resourceName}`)
          const policy = await cloudIdentityClient.getDlpRule(resourceName, authToken)

          return safeFormatResponse({
            rawData: policy,
            toolName: 'get_dlp_rule',
            formatFn: data => {
              const setting = data.setting || {}
              const value = setting.value || {}

              const name = value.displayName || setting.displayName || data.displayName || 'Unnamed Rule'
              const status = formatStatus(value.state || setting.state)

              let action = 'Unknown'
              const chromeAction = value.action?.chromeAction || {}
              const foundAction = Object.values(CHROME_ACTION_TYPES).find(a => chromeAction[a.apiKey])
              if (foundAction) {
                action = foundAction.value.charAt(0).toUpperCase() + foundAction.value.slice(1).toLowerCase()
              }

              const triggers = (value.triggers || []).map(t => t.replace(/^chrome\.dlp\.(v\d\.)?/, '')).join(', ')
              const condition = value.condition?.contentCondition || 'None'
              const uiLink = `https://admin.google.com/ac/dp/rules/${encodeURIComponent(data.name)}`

              const summary = `## DLP Rule: ${name}
- **Status**: ${status}
- **Action**: ${action}
- **Triggers**: ${triggers}
- **Condition**: \`${condition}\`
- **Resource Name**: \`${data.name}\`

💡 To **disable** or **delete** this rule, manage it in the Admin Console: [Manage in UI](${uiLink})`

              return formatToolResponse({
                summary,
                data: { dlpRule: { ...data, uiLink } },
                structuredContent: { dlpRule: { ...data, uiLink } },
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
