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
 * @fileoverview Tool definition for checking and enabling APIs.
 */

import { z } from 'zod'
import { guardedToolCall } from '../utils/wrapper.js'
import { TAGS, SERVICE_NAMES } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'check_and_enable_api' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/service_usage_client.js').ServiceUsageClient} options.serviceUsageClient - The Service Usage client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerCheckAndEnableApiTool(server, options, sessionState) {
  const { serviceUsageClient } = options
  logger.debug(`${TAGS.MCP} Registering 'check_and_enable_api' tool...`)

  server.registerTool(
    'check_and_enable_api',
    {
      description: `Checks if all required Google Cloud APIs are enabled for a project and enables them if requested.
      By default, it checks all required APIs (Admin SDK, Cloud Identity, etc.) unless checkAll is explicitly set to false and an apiName is provided.
      If any required API is disabled, the model MUST first ask the customer for confirmation and provide the direct Google Cloud Console link (https://console.cloud.google.com/apis/library/{apiName}?project={projectId}) for manual enablement.
      The model MUST specifically ask the customer whether they would like to check and enable ALL missing required APIs or just the specific one currently identified as missing.
      ONLY if the user explicitly agrees should the model call this tool again with 'enable: true' (and 'checkAll: true' if they agreed to enable all).`,
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID or number.'),
        apiName: z
          .enum(Object.values(SERVICE_NAMES))
          .optional()
          .describe('The API name to check/enable (e.g., admin.googleapis.com).'),
        enable: z.boolean().optional().describe('Whether to enable the API if it is disabled.'),
        checkAll: z.boolean().optional().describe('Whether to check all required APIs and enable the missing ones.'),
      },
    },
    guardedToolCall(
      {
        handler: async ({ projectId, apiName, enable = false, checkAll = false }, { requestInfo, authToken }) => {
          const actualApiName = apiName || SERVICE_NAMES.ADMIN_SDK
          logger.debug(
            `${TAGS.MCP} Calling 'check_and_enable_api' for project ${projectId} (enable: ${enable}, checkAll: ${checkAll}, apiName: ${actualApiName})`,
          )

          const apisToCheck = checkAll ? Object.values(SERVICE_NAMES) : [actualApiName]
          const results = []
          let serviceUsageDisabled = false

          for (const api of apisToCheck) {
            try {
              let status = await serviceUsageClient.getServiceStatus(projectId, api, authToken)

              if (status.state === 'ENABLED') {
                results.push(`✅ **API:** \`${api}\` is already ENABLED for project \`${projectId}\`.`)
              } else if (enable) {
                logger.info(`${TAGS.MCP} Enabling API [${api}] for project [${projectId}]...`)
                await serviceUsageClient.enableService(projectId, api, authToken)
                results.push(`✅ **API:** \`${api}\` has been successfully ENABLED for project \`${projectId}\`.`)
              } else {
                results.push(
                  `⚠️ **API:** \`${api}\` is currently DISABLED for project \`${projectId}\`.\n    *   [Manual enablement](https://console.cloud.google.com/apis/library/${api}?project=${projectId})`,
                )
              }
            } catch (error) {
              const errorMessage = error.message || ''
              const isServiceUsageError =
                error.status === 403 ||
                errorMessage.includes('serviceusage.googleapis.com') ||
                errorMessage.includes('Service Usage API')

              if (isServiceUsageError) {
                serviceUsageDisabled = true
                results.push(
                  `❌ **Error:** The Service Usage API is currently disabled for project \`${projectId}\`. This API is a prerequisite for checking or enabling other required services.\n    *   [Enable Service Usage API](https://console.cloud.google.com/apis/library/serviceusage.googleapis.com?project=${projectId})`,
                )
                // If service usage is disabled, we can't check any more APIs
                break
              } else {
                results.push(`❌ **Error checking/enabling API \`${api}\`:** ${errorMessage}`)
              }
            }
          }

          if (serviceUsageDisabled && results.length === 1) {
            return {
              content: [
                {
                  type: 'text',
                  text: `${results[0]}\n\nOnce the API has been enabled, please notify me so that I can re-attempt the check and enablement of all other required services.`,
                },
              ],
              structuredContent: {
                results,
              },
              isError: true,
            }
          }

          let resultText = results.join('\n\n')
          if (!enable && results.some(r => r.includes('DISABLED'))) {
            if (!checkAll) {
              resultText += `\n\nWould you like to enable the missing API(s) listed above, or should I check for and enable ALL required APIs for your project?`
            } else {
              resultText += `\n\nWould you like to enable the missing APIs found during the check? Call this tool again with 'enable: true'.`
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
            structuredContent: {
              results,
            },
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
