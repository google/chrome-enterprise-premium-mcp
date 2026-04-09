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

import { guardedToolCall } from '../utils/wrapper.js'

const TRIGGERS = {
  'google.workspace.chrome.file.v1.upload': 'Uploads',
  'google.workspace.chrome.file.v1.download': 'Downloads',
  'google.workspace.chrome.web_content.v1.upload': 'Web Content',
  'google.workspace.chrome.page.v1.print': 'Printing',
  'google.workspace.chrome.url.v1.navigation': 'Navigation',
}

export function registerListDlpRulesTool(server, options, sessionState) {
  const { cloudIdentityClient } = options

  server.registerTool(
    'list_dlp_rules',
    {
      description: `Lists Chrome DLP rules.`,
      inputSchema: {},
    },
    guardedToolCall(
      {
        handler: async (_, { _requestInfo, authToken }) => {
          const policies = await cloudIdentityClient.listDlpRules(authToken)

          const filtered = (policies || []).filter(p => p.setting?.value?.triggers?.some(t => TRIGGERS[t]))

          const format = s => {
            if (!s) {
              return 'Not configured'
            }
            return String(s)
              .replace(/_/g, ' ')
              .toLowerCase()
              .replace(/\b\w/g, l => l.toUpperCase())
          }

          if (filtered.length === 0) {
            return {
              content: [{ type: 'text', text: 'No DLP rules found.' }],
              structuredContent: { dlpRules: [] },
            }
          }

          const ruleEntries = filtered.map(p => {
            const setting = p.setting || {}
            const value = setting.value || {}

            const name = value.displayName || setting.displayName || p.displayName || 'Unnamed Rule'
            const status = format(setting.state)

            // Action extraction: look for Chrome specific actions
            let action = 'Unknown'
            const chromeAction = value.action?.chromeAction || {}
            if (chromeAction.blockContent) {
              action = 'Block'
            } else if (chromeAction.warnUser) {
              action = 'Warn'
            } else if (chromeAction.auditOnly) {
              action = 'Audit'
            } else if (value.action && typeof value.action === 'string') {
              action = format(value.action)
            }

            const triggers = (value.triggers || []).map(t => TRIGGERS[t] || 'Other').join(', ')

            return { name, status, action, triggers, resourceName: p.name }
          })

          const summary = ruleEntries
            .map(r => `- ${r.name}\n  * Status: ${r.status}\n  * Action: ${r.action}\n  * Triggers: ${r.triggers}`)
            .join('\n\n')

          const resourceMap = ruleEntries.map(r => `- "${r.name}" → ${r.resourceName}`).join('\n')

          return {
            content: [
              { type: 'text', text: summary },
              {
                type: 'text',
                text: `Resource names for API operations:\n${resourceMap}`,
              },
            ],
            structuredContent: { dlpRules: filtered },
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
