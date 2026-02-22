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
 * @fileoverview Tool definition for listing DLP detectors.
 */
import { z } from 'zod'
import { guardedToolCall, getAuthToken, inputSchemas, outputSchemas } from '../utils.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'list_detectors' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 */
export function registerListDetectorsTool(server, options) {
  const { cloudIdentityClient } = options

  logger.debug(`Registering 'list_detectors' tool...`)

  server.registerTool(
    'list_detectors',
    {
      description: `Lists all DLP detectors (URL lists, word lists, regex) for a given customer.
        The tool returns detectors with multiple attributes, parse them and return displayNames, summarize the action`,
      inputSchema: {},
      outputSchema: outputSchemas.policyList,
    },
    guardedToolCall(
      {
        handler: async (_, { requestInfo }) => {
          const authToken = getAuthToken(requestInfo)

          const policies = await cloudIdentityClient.listDetectors(authToken)
          if (!policies || policies.length === 0) {
            return { content: [{ type: 'text', text: `No DLP detectors found.` }] }
          }

          return {
            content: [
              {
                type: 'text',
                text: `DLP detectors:\n${JSON.stringify(policies, null, 2)}`,
              },
            ],
          }
        },
      },
      options.apiOptions,
    ),
  )
}
