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

import { guardedToolCall } from '../utils/wrapper.js'
import { createDetectorAndFormatResponse } from '../utils/detector.js'
import { logger } from '../../lib/util/logger.js'
import { TAGS } from '../../lib/constants.js'
import { WORKSPACE_RULE_LIMITS } from '../../lib/util/chrome_dlp_constants.js'

import { commonInputSchemas, commonOutputSchemas } from './shared.js'

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

  logger.debug(`${TAGS.MCP} Registering 'create_word_list_detector' tool...`)

  server.registerTool(
    'create_word_list_detector',
    {
      description: `Creates a new DLP word list detector.
Detectors are building blocks for DLP rules. After creating a detector, you must reference its resource name in a 'create_chrome_dlp_rule' condition (e.g., using the 'matches_detector' function).`,
      inputSchema: {
        customerId: commonInputSchemas.customerId,
        displayName: commonInputSchemas.detectorDisplayName,
        description: commonInputSchemas.detectorDescription,
        words: z
          .array(z.string())
          .min(1)
          .max(WORKSPACE_RULE_LIMITS.MAX_WORDS_IN_LIST)
          .describe(
            `A list of words to match. Total character count across all words must be ${WORKSPACE_RULE_LIMITS.MAX_WORD_LIST_CHARS} or less.`,
          ),
      },
      outputSchema: z
        .object({
          detector: commonOutputSchemas.cloudIdentityPolicy,
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async (params, { _requestInfo, authToken }) => {
          const { customerId, displayName, description, words } = params

          const totalChars = words.reduce((acc, word) => acc + word.length, 0)
          if (totalChars > WORKSPACE_RULE_LIMITS.MAX_WORD_LIST_CHARS) {
            throw new Error(
              `The total character count across all words must be ${WORKSPACE_RULE_LIMITS.MAX_WORD_LIST_CHARS} or less.`,
            )
          }

          const detectorConfig = {
            displayName: displayName,
            description: description || '',
            word_list: { words: words },
          }

          return createDetectorAndFormatResponse(
            apiClients,
            cloudIdentityClient,
            customerId,
            authToken,
            sessionState,
            detectorConfig,
            'word list',
          )
        },
      },
      options,
      sessionState,
    ),
  )
}
