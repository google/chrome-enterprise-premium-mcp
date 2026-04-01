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

import { guardedToolCall, getAuthToken, outputSchemas } from '../utils.js'

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
        handler: async (_, { requestInfo }) => {
          const authToken = getAuthToken(requestInfo)
          const detectors = await cloudIdentityClient.listDetectors(authToken)

          const format = s =>
            String(s || 'Unknown')
              .replace(/_/g, ' ')
              .toLowerCase()
              .replace(/\b\w/g, l => l.toUpperCase())

          const summary =
            !detectors || detectors.length === 0
              ? 'No detectors found.'
              : detectors
                  .map(p => {
                    const name = p.displayName || p.name?.split('/').pop() || 'Unnamed Detector'
                    return `- ${name} [Type: ${format(p.detectorType)}]`
                  })
                  .join('\n')

          return {
            content: [{ type: 'text', text: summary }],
            structuredContent: { detectors: detectors || [] },
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
