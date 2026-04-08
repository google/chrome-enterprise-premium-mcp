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

export function registerListDetectorsTool(server, options, sessionState) {
  const { cloudIdentityClient } = options

  server.registerTool(
    'list_detectors',
    {
      description: `Lists Chrome DLP detectors.`,
      inputSchema: {},
    },
    guardedToolCall(
      {
        handler: async (_, { _requestInfo, authToken }) => {
          const detectors = await cloudIdentityClient.listDetectors(authToken)

          const format = s =>
            String(s || 'Unknown')
              .replace(/_/g, ' ')
              .toLowerCase()
              .replace(/\b\w/g, l => l.toUpperCase())

          if (!detectors || detectors.length === 0) {
            return {
              content: [{ type: 'text', text: 'No detectors found.' }],
              structuredContent: { detectors: [] },
            }
          }

          const entries = detectors.map(p => {
            const value = p.setting?.value || {}
            return {
              displayName: value.displayName || p.name?.split('/').pop() || 'Unnamed Detector',
              type: format(p.setting?.type?.replace('settings/', '')),
              resourceName: p.name,
              details: JSON.stringify(value),
            }
          })

          const summary = entries.map(e => `- ${e.displayName} [Type: ${e.type}] - Details: ${e.details}`).join('\n')

          const resourceMap = entries.map(e => `- "${e.displayName}" → ${e.resourceName}`).join('\n')

          return {
            content: [
              { type: 'text', text: summary },
              {
                type: 'text',
                text: `Resource names for API operations:\n${resourceMap}`,
              },
            ],
            structuredContent: { detectors },
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
