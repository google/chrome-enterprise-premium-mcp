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
 * @fileoverview Tool definition for listing DLP (Data Loss Prevention) rules.
 */
import { z } from 'zod'
import { guardedToolCall, getAuthToken, inputSchemas, outputSchemas } from '../utils.js'
import { TAGS } from '../../lib/constants.js'

const SUPPORTED_TRIGGERS = [
  'google.workspace.chrome.file.v1.upload',
  'google.workspace.chrome.file.v1.download',
  'google.workspace.chrome.web_content.v1.upload',
  'google.workspace.chrome.page.v1.print',
  'google.workspace.chrome.url.v1.navigation',
]

/**
 * Registers the 'list_dlp_rules' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 */
export function registerListDlpRulesTool(server, options) {
  const { cloudIdentityClient } = options

  server.registerTool(
    'list_dlp_rules',
    {
      description: `Lists all DLP rules for a given customer.
        The tool returns rules with multiple attributes, parse them and return names, summarize the action`,
      inputSchema: {},
      outputSchema: outputSchemas.policyList,
    },
    guardedToolCall(
      {
        handler: async (_, { requestInfo }) => {
          const authToken = getAuthToken(requestInfo)

          const policies = await cloudIdentityClient.listDlpRules(authToken)
          if (!policies || policies.length === 0) {
            return { content: [{ type: 'text', text: `No DLP rules found.` }] }
          }

          const filteredPolicies = policies.filter(policy => {
            const triggers = policy.setting?.value?.triggers
            if (triggers) {
              return triggers.some(trigger => SUPPORTED_TRIGGERS.includes(trigger))
            }
            return false
          })

          if (!filteredPolicies || filteredPolicies.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No DLP rules found with supported triggers.`,
                },
              ],
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: `DLP rules:\n${JSON.stringify(filteredPolicies, null, 2)}`,
              },
            ],
          }
        },
      },
      options.apiOptions,
    ),
  )
}
