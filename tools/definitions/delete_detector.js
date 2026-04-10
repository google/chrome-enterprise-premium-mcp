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
 * @file Tool definition for deleting DLP detectors.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse, safeFormatResponse } from '../utils/wrapper.js'
import { logger } from '../../lib/util/logger.js'
import { TAGS } from '../../lib/constants.js'

/**
 * Registers the 'delete_detector' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerDeleteDetectorTool(server, options, sessionState) {
  const { cloudIdentityClient } = options

  logger.debug(`${TAGS.MCP} Registering 'delete_detector' tool...`)

  server.registerTool(
    'delete_detector',
    {
      description: `Deletes a DLP detector (URL list, word list, or regex).
Note: This will not automatically remove the detector from any DLP rules that reference it. You should update or delete the affected rules separately.`,
      inputSchema: {
        policyName: z
          .string()
          .startsWith('policies/')
          .describe('The resource name of the detector (e.g. policies/akajj264apk5psphei)'),
      },
      outputSchema: z
        .object({
          success: z.boolean(),
          policyName: z.string(),
          displayName: z.string().optional(),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        /**
         * Handler for deleting a DLP detector.
         * @param {object} params - The tool parameters.
         * @param {string} params.policyName - The resource name of the detector.
         * @param {object} context - The tool execution context.
         * @param {string} context.authToken - The OAuth2 access token.
         * @returns {Promise<object>} The formatted tool response.
         */
        handler: async ({ policyName }, { authToken }) => {
          // Retrieve display name before deletion for the confirmation message
          let displayName = policyName.split('/').pop()
          try {
            const detector = await cloudIdentityClient.getDetector(policyName, authToken)
            displayName = detector?.setting?.value?.displayName || displayName
          } catch {
            // Lookup failed; use the extracted ID segment as the display name
          }

          const result = await cloudIdentityClient.deleteDetector(policyName, authToken)

          return safeFormatResponse({
            rawData: { success: true, policyName, displayName, result },
            toolName: 'delete_detector',
            formatFn: raw => {
              const sc = { success: raw.success, policyName: raw.policyName, displayName: raw.displayName }
              return formatToolResponse({
                summary: `Successfully deleted detector "${raw.displayName}" (\`${raw.policyName}\`).`,
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
