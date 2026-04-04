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
 * @fileoverview Tool definition for creating word list DLP detectors.
 */
import { z } from 'zod'

import { guardedToolCall, getAuthToken, inputSchemas, outputSchemas, resolveRootOrgUnitId } from '../utils.js'
import { logger } from '../../lib/util/logger.js'
import { WORKSPACE_RULE_LIMITS } from '../../lib/util/chrome_dlp_constants.js'

/**
 * Registers the 'create_word_list_detector' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerCreateWordListDetectorTool(server, options, sessionState) {
  const { cloudIdentityClient, apiClients } = options

  logger.debug(`Registering 'create_word_list_detector' tool...`)

  server.registerTool(
    'create_word_list_detector',
    {
      description: 'Creates a new DLP word list detector.',
      inputSchema: {
        customerId: inputSchemas.customerId,
        displayName: z
          .string()
          .max(WORKSPACE_RULE_LIMITS.NAME_MAX_LENGTH)
          .describe('The display name for the detector.'),
        description: z
          .string()
          .max(WORKSPACE_RULE_LIMITS.DESCRIPTION_MAX_LENGTH)
          .optional()
          .describe('An optional description for the detector.'),
        words: z
          .array(z.string())
          .min(1)
          .max(WORKSPACE_RULE_LIMITS.MAX_WORDS_IN_LIST)
          .describe(
            `A list of words to match. Total character count across all words must be ${WORKSPACE_RULE_LIMITS.MAX_WORD_LIST_CHARS} or less.`,
          ),
      },
    },
    guardedToolCall(
      {
        handler: async (params, { requestInfo }) => {
          const { customerId, displayName, description, words } = params
          const authToken = getAuthToken(requestInfo)

          const totalChars = words.reduce((acc, word) => acc + word.length, 0)
          if (totalChars > WORKSPACE_RULE_LIMITS.MAX_WORD_LIST_CHARS) {
            throw new Error(
              `The total character count across all words must be ${WORKSPACE_RULE_LIMITS.MAX_WORD_LIST_CHARS} or less.`,
            )
          }

          const orgUnitId = await resolveRootOrgUnitId(apiClients, customerId, authToken, sessionState)
          if (!orgUnitId) {
            throw new Error('Failed to resolve root organizational unit ID.')
          }

          const detectorConfig = {
            displayName: displayName,
            description: description || '',
            word_list: { words: words },
          }

          const result = await cloudIdentityClient.createDetector(customerId, orgUnitId, detectorConfig, authToken)

          const createdPolicy = result.response

          return {
            content: [
              {
                type: 'text',
                text: `Successfully created word list detector: ${createdPolicy.name}\n\nDetails:\n${JSON.stringify(createdPolicy, null, 2)}`,
              },
            ],
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
