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
 * @param {import('../../lib/api/service_usage_client.js').ServiceUsageClient} options.serviceUsageClient - The Service Usage client instance.
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
      outputSchema: z.looseObject({
        apiStatuses: z.array(
          z.looseObject({
            apiName: z.string(),
            status: z.string(),
            projectId: z.string(),
            errorMessage: z.string().optional(),
            consoleLink: z.string().optional(),
          }),
        ),
      }),
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

          let enabledServices
          try {
            enabledServices = await serviceUsageClient.listEnabledServices(projectId, authToken)
          } catch (error) {
            const errorMessage = error.message || ''
            const status = error.status || error.code || error.response?.status
            const mentionsServiceManagement =
              errorMessage.includes('Service Management API') || errorMessage.includes(SERVICE_NAMES.SERVICE_MANAGEMENT)

            if (mentionsServiceManagement || status === 403) {
              const consoleLink = `https://console.cloud.google.com/apis/library/${SERVICE_NAMES.SERVICE_MANAGEMENT}?project=${projectId}`
              const summary =
                `## API Status (1)\n\n` +
                `- **${SERVICE_NAMES.SERVICE_MANAGEMENT}** — ERROR: Service Management API is disabled in project \`${projectId}\`. ` +
                `This is a prerequisite for checking enablement of other APIs. [Enable Service Management API](${consoleLink})\n\n` +
                `Once the API has been enabled, please notify me so that I can re-attempt the check and enablement of all other required services.`
              const apiStatuses = [
                {
                  apiName: SERVICE_NAMES.SERVICE_MANAGEMENT,
                  status: 'ERROR',
                  projectId,
                  errorMessage,
                  consoleLink,
                },
              ]
              return formatToolResponse({
                summary,
                data: { apiStatuses },
                structuredContent: { apiStatuses, error: true },
              })
            }
            throw error
          }

          for (const api of apisToCheck) {
            if (enabledServices.has(api)) {
              results.push(`- **${api}** — ENABLED (project: \`${projectId}\`)`)
              apiStatuses.push({ apiName: api, status: 'ENABLED', projectId })
              continue
            }
            if (!enable) {
              const consoleLink = `https://console.cloud.google.com/apis/library/${api}?project=${projectId}`
              results.push(`- **${api}** — DISABLED (project: \`${projectId}\`)`)
              apiStatuses.push({ apiName: api, status: 'DISABLED', projectId, consoleLink })
              continue
            }
            logger.info(`${TAGS.MCP} Enabling API [${api}] for project [${projectId}]...`)
            try {
              const enableResponse = await serviceUsageClient.enableService(projectId, api, authToken)
              if (enableResponse?.error) {
                const errMessage = enableResponse.error.message || JSON.stringify(enableResponse.error)
                results.push(`- **${api}** — FAILED (project: \`${projectId}\`): ${errMessage}`)
                apiStatuses.push({ apiName: api, status: 'FAILED', projectId, error: errMessage })
              } else if (enableResponse?.done === true) {
                results.push(`- **${api}** — NEWLY_ENABLED (project: \`${projectId}\`)`)
                apiStatuses.push({ apiName: api, status: 'ENABLED', projectId })
              } else if (enableResponse?.done === false) {
                results.push(
                  `- **${api}** — ENABLING (project: \`${projectId}\`): enable requested, may take a few minutes. Re-run this tool to verify status.`,
                )
                const enablingStatus = { apiName: api, status: 'ENABLING', projectId }
                if (enableResponse?.name) {
                  enablingStatus.operationName = enableResponse.name
                }
                apiStatuses.push(enablingStatus)
              } else {
                results.push(
                  `- **${api}** — UNKNOWN (project: \`${projectId}\`): unexpected response from Service Usage; re-run this tool to verify status.`,
                )
                apiStatuses.push({ apiName: api, status: 'UNKNOWN', projectId })
              }
            } catch (error) {
              const errorMessage = error.message || ''
              results.push(`- **${api}** — ERROR: ${errorMessage} (project: \`${projectId}\`)`)
              apiStatuses.push({ apiName: api, status: 'ERROR', projectId, errorMessage })
            }
          }

          let resultText = `## API Status (${apiStatuses.length})\n\n${results.join('\n')}`

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
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )
}
