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
 * @fileoverview Tool definition for deleting DLP detectors.
 */

import { z } from 'zod'
import { guardedToolCall, getAuthToken, inputSchemas, outputSchemas } from '../utils.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'delete_detector' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerDeleteDetectorTool(server, options, sessionState) {
  const { cloudIdentityClient } = options

  logger.debug(`Registering 'delete_detector' tool...`)

  server.registerTool(
    'delete_detector',
    {
      description: 'Deletes a DLP detector (URL list, word list, or regex).',
      inputSchema: {
        policyName: inputSchemas.detectorResourceName,
      },
    },
    guardedToolCall(
      {
        handler: async ({ policyName }, { requestInfo }) => {
          const authToken = getAuthToken(requestInfo)

          // Fetch display name before deletion for user-friendly confirmation
          let displayName = policyName.split('/').pop()
          try {
            const detector = await cloudIdentityClient.getDetector(policyName, authToken)
            displayName = detector?.setting?.value?.displayName || displayName
          } catch {
            // Use extracted ID as fallback
          }

          await cloudIdentityClient.deleteDetector(policyName, authToken)

          return {
            content: [
              {
                type: 'text',
                text: `Successfully deleted detector "${displayName}".`,
              },
            ],
            structuredContent: {
              success: true,
              policyName,
            },
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
