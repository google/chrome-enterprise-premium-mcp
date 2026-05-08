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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { TAGS, SERVICE_NAMES } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { isApiError } from '../../lib/util/helpers.js'

const SERVICE_NAMES_VALUES = Object.values(SERVICE_NAMES) as [string, ...string[]]

const CheckAndEnableCepApiSchema = z.object({
  projectId: z.string(),
  apiName: z.enum(SERVICE_NAMES_VALUES).optional(),
  enable: z.boolean().optional(),
  checkAll: z.boolean().optional(),
})

type CheckAndEnableCepApiParams = z.infer<typeof CheckAndEnableCepApiSchema>

interface ApiStatusResult {
  apiName: string
  status: string
  projectId: string
  errorMessage?: string
  consoleLink?: string
  operationName?: string
  error?: boolean
}

/**
 * Registers the 'check_and_enable_cep_api' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerCheckAndEnableCepApiTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const serviceUsageClient = apiClients?.serviceUsage
  logger.debug(`${TAGS.MCP} Registering 'check_and_enable_cep_api' tool...`)

  server.registerTool(
    'check_and_enable_cep_api',
    {
      description: `Verify or enable Google Cloud APIs required for Chrome Enterprise Premium features.
This is a PREREQUISITE tool. Many other tools will fail if necessary APIs are disabled. Always ask the user before enabling APIs unless they have explicitly authorized it in this turn.`,
      inputSchema: {
        projectId: z.string().describe('The Google Cloud project ID or number.'),
        apiName: z
          .enum(SERVICE_NAMES_VALUES)
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
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          if (!serviceUsageClient) {
            throw new Error('serviceUsageClient is required for check_and_enable_cep_api')
          }

          // Strictly parse and type-narrow using Zod
          const safeParams: CheckAndEnableCepApiParams = CheckAndEnableCepApiSchema.parse(params)
          const { projectId, apiName, enable = false, checkAll = true } = safeParams

          const actualApiName = apiName || SERVICE_NAMES.ADMIN_SDK
          logger.debug(
            `${TAGS.MCP} Calling 'check_and_enable_cep_api' for project ${projectId} (enable: ${String(enable)}, checkAll: ${String(checkAll)}, apiName: ${actualApiName})`,
          )

          const apisToCheck = checkAll ? Object.values(SERVICE_NAMES) : [actualApiName]
          const results: string[] = []
          const apiStatuses: ApiStatusResult[] = []
          let serviceUsageDisabled = false

          for (const api of apisToCheck) {
            try {
              const status = await serviceUsageClient.getServiceStatus(projectId, api, authToken || '')

              if (status.state === 'ENABLED') {
                results.push(`- **${api}** — ENABLED (project: \`${projectId}\`)`)
                apiStatuses.push({ apiName: api, status: 'ENABLED', projectId })
              } else if (enable) {
                logger.info(`${TAGS.MCP} Enabling API [${api}] for project [${projectId}]...`)
                const enableResponse = await serviceUsageClient.enableService(projectId, api, authToken || '')
                if (enableResponse?.error) {
                  const errMessage = enableResponse.error.message || JSON.stringify(enableResponse.error)
                  results.push(`- **${api}** — FAILED (project: \`${projectId}\`): ${errMessage}`)
                  apiStatuses.push({ apiName: api, status: 'FAILED', projectId, errorMessage: errMessage })
                } else if (enableResponse?.done === true) {
                  results.push(`- **${api}** — NEWLY_ENABLED (project: \`${projectId}\`)`)
                  apiStatuses.push({ apiName: api, status: 'ENABLED', projectId })
                } else if (enableResponse?.done === false) {
                  results.push(
                    `- **${api}** — ENABLING (project: \`${projectId}\`): enable requested, may take a few minutes. Re-run this tool to verify status.`,
                  )
                  const enablingStatus: ApiStatusResult = { apiName: api, status: 'ENABLING', projectId }
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
              } else {
                const consoleLink = `https://console.cloud.google.com/apis/library/${api}?project=${projectId}`
                results.push(`- **${api}** — DISABLED (project: \`${projectId}\`)`)
                apiStatuses.push({ apiName: api, status: 'DISABLED', projectId, consoleLink })
              }
            } catch (error) {
              if (isApiError(error)) {
                const errorMessage = error.message || ''
                const status = error.response?.status
                const isAuthError =
                  status === 401 ||
                  status === 403 ||
                  errorMessage.includes('UNAUTHENTICATED') ||
                  errorMessage.includes('PERMISSION_DENIED') ||
                  errorMessage.includes('invalid_grant')

                const mentionsServiceUsage =
                  errorMessage.includes('Service Usage API') || /\bserviceusage\.googleapis\.com\b/.test(errorMessage)

                if (isAuthError && !mentionsServiceUsage) {
                  throw error
                }

                const isServiceUsageError = status === 403 || mentionsServiceUsage

                if (isServiceUsageError) {
                  serviceUsageDisabled = true
                  const consoleLink = `https://console.cloud.google.com/apis/library/serviceusage.googleapis.com?project=${projectId}`
                  results.push(
                    `- **${api}** — ERROR: Service Usage API is disabled. This is a prerequisite. [Enable Service Usage API](${consoleLink})`,
                  )
                  apiStatuses.push({ apiName: api, status: 'ERROR', projectId, errorMessage, consoleLink })
                  break
                } else {
                  results.push(`- **${api}** — ERROR: ${errorMessage} (project: \`${projectId}\`)`)
                  apiStatuses.push({ apiName: api, status: 'ERROR', projectId, errorMessage })
                }
              } else if (error instanceof Error) {
                results.push(`- **${api}** — ERROR: ${error.message} (project: \`${projectId}\`)`)
                apiStatuses.push({ apiName: api, status: 'ERROR', projectId, errorMessage: error.message })
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
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )
}
