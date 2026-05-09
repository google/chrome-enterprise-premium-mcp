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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  safeFormatResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { logger } from '../../lib/util/logger.js'
import { TAGS } from '../../lib/constants.js'
import { isObject, getString, getObject } from '../../lib/util/helpers.js'

/**
 * Registers the 'delete_detector' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerDeleteDetectorTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const cloudIdentityClient = apiClients?.cloudIdentity

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
        handler: async ({ policyName }, { authToken }): Promise<McpToolResponse> => {
          if (!cloudIdentityClient) {
            throw new Error('cloudIdentityClient is required for delete_detector')
          }
          if (typeof policyName !== 'string') {
            throw new Error('policyName must be a string')
          }

          // Retrieve display name before deletion for the confirmation message
          let displayName = policyName.split('/').pop() || ''
          try {
            const detector = await cloudIdentityClient.getDetector(policyName, authToken || '')
            const setting = isObject(detector) ? getObject(detector, 'setting') : null
            const settingValue = setting ? getObject(setting, 'value') : null
            displayName = (settingValue && getString(settingValue, 'displayName')) || displayName
          } catch {
            // Lookup failed; use the extracted ID segment as the display name
          }

          const result = await cloudIdentityClient.deleteDetector(policyName, authToken || '')

          return safeFormatResponse({
            rawData: { success: true, policyName, displayName, result },
            toolName: 'delete_detector',
            formatFn: (raw: unknown): McpToolResponse => {
              if (!isObject(raw)) {
                throw new Error('delete_detector formatting failed: raw is not an object')
              }
              const success = !!raw.success
              const policyNameVal = getString(raw, 'policyName') || ''
              const displayNameVal = getString(raw, 'displayName') || ''

              const sc = { success, policyName: policyNameVal, displayName: displayNameVal }
              return formatToolResponse({
                summary: `Successfully deleted detector "${displayNameVal}" (\`${policyNameVal}\`).`,
                data: sc,
                structuredContent: sc,
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
