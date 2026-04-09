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
 * @fileoverview Tool definition for creating regular expression DLP detectors.
 */

import { z } from 'zod'

import { guardedToolCall } from '../utils/wrapper.js'
import { createDetectorAndFormatResponse } from '../utils/detector.js'
import { logger } from '../../lib/util/logger.js'
import { TAGS } from '../../lib/constants.js'

import { commonInputSchemas, commonOutputSchemas } from './shared.js'

/**
 * Registers the 'create_regex_detector' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerCreateRegexDetectorTool(server, options, sessionState) {
  const { cloudIdentityClient, apiClients } = options

  logger.debug(`${TAGS.MCP} Registering 'create_regex_detector' tool...`)

  server.registerTool(
    'create_regex_detector',
    {
      description: `Creates a new DLP regular expression detector.
Detectors are building blocks for DLP rules. After creating a detector, you must reference its resource name in a 'create_chrome_dlp_rule' condition (e.g., using the 'matches_detector' function).`,
      inputSchema: {
        customerId: commonInputSchemas.customerId,
        displayName: commonInputSchemas.detectorDisplayName,
        description: commonInputSchemas.detectorDescription,
        expression: z.string().describe(`A regular expression to match.`),
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
          const { customerId, displayName, description, expression } = params

          const detectorConfig = {
            displayName: displayName,
            description: description || '',
            regular_expression: { expression: expression },
          }

          return createDetectorAndFormatResponse(
            apiClients,
            cloudIdentityClient,
            customerId,
            authToken,
            sessionState,
            detectorConfig,
            'regular expression',
          )
        },
      },
      options,
      sessionState,
    ),
  )
}
