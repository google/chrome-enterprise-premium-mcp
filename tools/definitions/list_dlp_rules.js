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

export function registerListDlpRulesTool(server, options, sessionState) {
  const { cloudIdentityClient } = options
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
        handler: async (_, { authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'list_dlp_rules'`)
          const policies = await cloudIdentityClient.listDlpRules(authToken)

          return safeFormatResponse({
            rawData: policies,
            toolName: 'list_dlp_rules',
            formatFn: data => {
              if (!data || data.length === 0) {
                return formatToolResponse({
                  summary: 'No Chrome DLP rules were found in this organization.',
                  data: { dlpRules: [] },
                  structuredContent: { dlpRules: [] },
                })
              }

              const format = s => {
                if (!s) {
                  return 'Unknown'
                }
                return String(s)
                  .replace(/_/g, ' ')
                  .toLowerCase()
                  .replace(/\b\w/g, l => l.toUpperCase())
              }

              const ruleEntries = data.map(p => {
                const setting = p.setting || {}
                const value = setting.value || {}

                const name = value.displayName || setting.displayName || p.displayName || 'Unnamed Rule'
                const status = format(value.state || setting.state)

                let action = 'Unknown'
                const chromeAction = value.action?.chromeAction || {}
                if (chromeAction.blockContent) {
                  action = 'Block'
                } else if (chromeAction.warnUser) {
                  action = 'Warn'
                } else if (chromeAction.auditOnly) {
                  action = 'Audit'
                }

                const triggers = (value.triggers || []).map(t => t.replace(/^chrome\.dlp\.(v\d\.)?/, '')).join(', ')
                const condition = value.condition?.contentCondition || 'None'

                return { name, status, action, triggers, condition, resourceName: p.name }
              })

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
      },
      options,
      sessionState,
    ),
  )
}
