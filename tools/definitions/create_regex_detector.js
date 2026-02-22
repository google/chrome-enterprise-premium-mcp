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

import { guardedToolCall, getAuthToken, inputSchemas, outputSchemas } from '../utils.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'create_regex_detector' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 */
export function registerCreateRegexDetectorTool(server, options) {
  const { cloudIdentityClient } = options

  logger.debug(`Registering 'create_regex_detector' tool...`)

  server.registerTool(
    'create_regex_detector',
    {
      description: 'Creates a new DLP regular expression detector.',
      inputSchema: {
        customerId: inputSchemas.customerId,
        orgUnitId: inputSchemas.orgUnitId.describe(`The ID of the organizational unit for the detector.`),
        displayName: z.string().describe(`The display name for the detector.`),
        description: z.string().optional().describe(`An optional description for the detector.`),
        expression: z.string().describe(`A regular expression to match.`),
      },
      outputSchema: outputSchemas.singlePolicy,
    },
    guardedToolCall(
      {
        handler: async (params, { requestInfo }) => {
          const { customerId, orgUnitId, displayName, description, expression } = params
          const authToken = getAuthToken(requestInfo)

          const detectorConfig = {
            displayName: displayName,
            description: description || '',
            regular_expression: { expression: expression },
          }

          const createdPolicy = await cloudIdentityClient.createDetector(
            customerId,
            orgUnitId,
            detectorConfig,
            authToken,
          )

          return {
            content: [
              {
                type: 'text',
                text: `Successfully created regular expression detector: ${createdPolicy.name}

Details:
${JSON.stringify(createdPolicy, null, 2)}`,
              },
            ],
          }
        },
      },
      options.apiOptions,
    ),
  )
}
