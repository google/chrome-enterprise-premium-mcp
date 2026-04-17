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
 * @file Tool definition for checking and enabling Chrome Enterprise Premium APIs.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { TAGS, SERVICE_NAMES } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Registers the 'check_and_enable_cep_api' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/service_usage_client.js').ServiceUsageClient} options.serviceUsageClient - The Service Usage client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerCheckAndEnableCepApiTool(server, options, sessionState) {
  const { serviceUsageClient } = options
  logger.debug(`${TAGS.MCP} Registering 'check_and_enable_cep_api' tool...`)

  server.registerTool(
    'check_and_enable_cep_api',
    {
      description: `Verify or enable Google Cloud APIs required for Chrome Enterprise Premium features.
This is a PREREQUISITE tool. Many other tools will fail if necessary APIs are disabled. Always ask the user before enabling APIs unless they have explicitly authorized it in this turn.`,
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID or number.'),
        apiName: z
          .enum(Object.values(SERVICE_NAMES))
          .optional()
          .describe('The API name to check/enable (e.g., admin.googleapis.com).'),
        enable: z.boolean().optional().describe('Whether to enable the API if it is disabled.'),
        checkAll: z.boolean().optional().describe('Whether to check all required APIs and enable the missing ones.'),
      },
      outputSchema: z
        .object({
          apiStatuses: z.array(
            z
              .object({
                apiName: z.string(),
                status: z.string(),
                projectId: z.string(),
                errorMessage: z.string().optional(),
                consoleLink: z.string().optional(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async ({ projectId, apiName, enable = false, checkAll = true }, { _requestInfo, authToken }) => {
          const actualApiName = apiName || SERVICE_NAMES.ADMIN_SDK
          logger.debug(
            `${TAGS.MCP} Calling 'check_and_enable_cep_api' for project ${projectId} (enable: ${enable}, checkAll: ${checkAll}, apiName: ${actualApiName})`,
          )

          const apisToCheck = checkAll ? Object.values(SERVICE_NAMES) : [actualApiName]
          const results = []
          const apiStatuses = []
          let serviceUsageDisabled = false

          for (const api of apisToCheck) {
            try {
              let status = await serviceUsageClient.getServiceStatus(projectId, api, authToken)

              if (status.state === 'ENABLED') {
                results.push(`- **${api}** — ENABLED (project: \`${projectId}\`)`)
                apiStatuses.push({ apiName: api, status: 'ENABLED', projectId })
              } else if (enable) {
                logger.info(`${TAGS.MCP} Enabling API [${api}] for project [${projectId}]...`)
                await serviceUsageClient.enableService(projectId, api, authToken)
                results.push(`- **${api}** — NEWLY_ENABLED (project: \`${projectId}\`)`)
                apiStatuses.push({ apiName: api, status: 'ENABLED', projectId })
              } else {
                const consoleLink = `https://console.cloud.google.com/apis/library/${api}?project=${projectId}`
                results.push(`- **${api}** — DISABLED (project: \`${projectId}\`)`)
                apiStatuses.push({ apiName: api, status: 'DISABLED', projectId, consoleLink })
              }
            } catch (error) {
              const errorMessage = error.message || ''
              const isServiceUsageError =
                error.status === 403 ||
                errorMessage.includes('serviceusage.googleapis.com') ||
                errorMessage.includes('Service Usage API')

              if (isServiceUsageError) {
                serviceUsageDisabled = true
                const consoleLink = `https://console.cloud.google.com/apis/library/serviceusage.googleapis.com?project=${projectId}`
                results.push(
                  `- **${api}** — ERROR: Service Usage API is disabled. This is a prerequisite. [Enable Service Usage API](${consoleLink})`,
                )
                apiStatuses.push({ apiName: api, status: 'ERROR', projectId, errorMessage, consoleLink })
                // If service usage is disabled, we can't check any more APIs
                break
              } else {
                results.push(`- **${api}** — ERROR: ${errorMessage} (project: \`${projectId}\`)`)
                apiStatuses.push({ apiName: api, status: 'ERROR', projectId, errorMessage })
              }
            }
          }

          let resultText = `## API Status (${apiStatuses.length})\n\n${results.join('\n')}`

          if (serviceUsageDisabled) {
            resultText += `\n\nOnce the API has been enabled, please notify me so that I can re-attempt the check and enablement of all other required services.`
            return formatToolResponse({
              summary: resultText,
              data: { apiStatuses },
              structuredContent: { apiStatuses, error: true },
            })
          }

          if (!enable && apiStatuses.some(s => s.status === 'DISABLED')) {
            if (!checkAll) {
              resultText += `\n\nWould you like to enable the missing API(s) listed above, or should I check for and enable ALL required APIs for your project?`
            } else {
              resultText += `\n\nWould you like to enable the missing APIs found during the check? Call this tool again with 'enable: true'.`
            }
          }

          return formatToolResponse({
            summary: resultText,
            data: { apiStatuses },
            structuredContent: { apiStatuses },
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
