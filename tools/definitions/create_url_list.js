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
 * @fileoverview Tool definition for creating URL lists.
 */

import { z } from 'zod'

import { guardedToolCall, getAuthToken, commonSchemas } from '../utils.js'
import { TAGS } from '../../lib/constants.js'

/**
 * Registers the 'create_url_list' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 */
export function registerCreateUrlListTool(server, options) {
  const { cloudIdentityClient } = options

  server.registerTool(
    'create_url_list',
    {
      description: 'Creates a new URL list.',
      inputSchema: {
        customerId: commonSchemas.customerId,
        orgUnitId: commonSchemas.orgUnitId.describe(`The ID of the organizational unit for the URL list.`),
        displayName: z.string().describe(`The display name for the URL list.`),
        urls: z.array(z.string()).describe(`A list of URLs to include in the list.`),
      },
    },
    guardedToolCall(
      {
        handler: async ({ customerId, orgUnitId, displayName, urls }, { requestInfo }) => {
          const authToken = getAuthToken(requestInfo)
          const urlListConfig = {
            display_name: displayName,
            urls: urls,
          }

          const createdPolicy = await cloudIdentityClient.createUrlList(customerId, orgUnitId, urlListConfig, authToken)

          return {
            content: [
              {
                type: 'text',
                text: `Successfully created URL list: ${createdPolicy.name}\n\nDetails:\n${JSON.stringify(createdPolicy, null, 2)}`,
              },
            ],
          }
        },
      },
      options.apiOptions,
    ),
  )
}
