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
 * @file Tool definition for creating regular expression DLP detectors.
 */

import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { guardedToolCall, GuardedToolOptions, SessionState, McpToolResponse } from '../utils/wrapper.js'
import { createDetectorAndFormatResponse } from '../utils/detector.js'
import { logger } from '../../lib/util/logger.js'
import { TAGS } from '../../lib/constants.js'
import { commonInputSchemas, commonOutputSchemas } from './shared.js'

const CreateRegexDetectorSchema = z.object({
  customerId: commonInputSchemas.customerId,
  displayName: commonInputSchemas.detectorDisplayName,
  description: commonInputSchemas.detectorDescription,
  expression: z.string().describe('A regular expression to match.'),
})

type CreateRegexDetectorParams = z.infer<typeof CreateRegexDetectorSchema>

/**
 * Registers the 'create_regex_detector' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerCreateRegexDetectorTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const cloudIdentityClient = apiClients?.cloudIdentity

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
        expression: z.string().describe('A regular expression to match.'),
      },
      outputSchema: z
        .object({
          detector: commonOutputSchemas.cloudIdentityPolicy,
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          // Use the top-level schema directly for strict, cast-free parsing!
          const safeParams: CreateRegexDetectorParams = CreateRegexDetectorSchema.parse(params)
          const { customerId, displayName, description, expression } = safeParams

          if (!cloudIdentityClient) {
            throw new Error('cloudIdentityClient is required for create_regex_detector')
          }
          if (!apiClients) {
            throw new Error('apiClients collection is required for create_regex_detector')
          }

          const detectorConfig = {
            displayName: displayName,
            description: description || '',
            regular_expression: { expression: expression },
          }

          return createDetectorAndFormatResponse(
            apiClients,
            cloudIdentityClient,
            customerId || '',
            authToken || '',
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
