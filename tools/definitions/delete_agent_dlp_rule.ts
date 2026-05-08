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
 * @file Tool definition for deleting DLP rules.
 */

import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  safeFormatResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { AGENT_DISPLAY_NAME_PREFIX, ADMIN_CONSOLE_DLP_RULE_LINK_TEMPLATE } from '../../lib/util/chrome_dlp_constants.js'
import { isObject, getString, getObject, isApiError } from '../../lib/util/helpers.js'

/**
 * Registers the 'delete_agent_dlp_rule' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerDeleteAgentDlpRuleTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const cloudIdentityClient = apiClients?.cloudIdentity
  logger.debug(`${TAGS.MCP} Registering 'delete_agent_dlp_rule' tool...`)

  server.registerTool(
    'delete_agent_dlp_rule',
    {
      description: `Deletes an agent-created DLP rule (prefixed with '${AGENT_DISPLAY_NAME_PREFIX}'). For security, this tool only permits deleting rules that were originally created by the agent.`,
      inputSchema: {
        policyName: z
          .string()
          .startsWith('policies/')
          .describe('The resource name of the DLP rule (e.g. policies/ajjs664skp992kska)'),
      },
      outputSchema: z
        .object({
          success: z.boolean(),
          policyName: z.string(),
          displayName: z.string().optional(),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async ({ policyName }, { authToken }): Promise<McpToolResponse> => {
          logger.debug(`${TAGS.MCP} Calling 'delete_agent_dlp_rule' with policyName: ${String(policyName)}`)
          if (!cloudIdentityClient) {
            throw new Error('cloudIdentityClient is required for delete_agent_dlp_rule')
          }
          if (typeof policyName !== 'string') {
            throw new Error('policyName must be a string')
          }

          let rule: unknown
          try {
            rule = await cloudIdentityClient.getDlpRule(policyName, authToken || '')
          } catch (error) {
            if (isApiError(error)) {
              const status = error.response?.status
              if (status === 404) {
                throw new Error(`Rule not found: ${policyName}`)
              }
            } else if (isObject(error) && 'code' in error && (error.code === 5 || error.code === '5')) {
              throw new Error(`Rule not found: ${policyName}`)
            } else if (error instanceof Error) {
              if (
                error.message?.toLowerCase().includes('not found') ||
                error.message?.toLowerCase().includes('not_found')
              ) {
                throw new Error(`Rule not found: ${policyName}`)
              }
              logger.error(`${TAGS.MCP} Failed to fetch rule details for ${policyName}: ${error.message}`)
            }
            throw error
          }

          const setting = isObject(rule) ? getObject(rule, 'setting') : null
          const settingValue = setting ? getObject(setting, 'value') : null
          const displayName = settingValue ? getString(settingValue, 'displayName') || '' : ''
          const isAgentCreated = displayName.startsWith(AGENT_DISPLAY_NAME_PREFIX)

          if (isAgentCreated) {
            await cloudIdentityClient.deleteDlpRule(policyName, authToken || '')
            logger.debug(`${TAGS.MCP} Successfully deleted agent-created DLP rule: ${policyName}`)
          }

          return safeFormatResponse({
            rawData: { success: isAgentCreated, policyName, displayName, isAgentCreated },
            toolName: 'delete_agent_dlp_rule',
            formatFn: (raw: unknown): McpToolResponse => {
              if (!isObject(raw)) {
                throw new Error('delete_agent_dlp_rule formatting failed: raw is not an object')
              }
              const success = !!raw.success
              const isAgentCreatedVal = !!raw.isAgentCreated
              const policyNameVal = getString(raw, 'policyName') || ''
              const displayNameVal = getString(raw, 'displayName') || ''

              const sc = { success, policyName: policyNameVal, displayName: displayNameVal }
              if (isAgentCreatedVal) {
                return formatToolResponse({
                  summary: `The agent-created Chrome DLP rule "${displayNameVal}" (ID: \`${policyNameVal}\`) has been successfully deleted.`,
                  data: sc,
                  structuredContent: sc,
                })
              } else {
                const encodedPolicyName = encodeURIComponent(policyNameVal)
                const adminConsoleLink = ADMIN_CONSOLE_DLP_RULE_LINK_TEMPLATE.replace(
                  '{URL_ENCODED_RESOURCE_NAME}',
                  encodedPolicyName,
                )

                logger.debug(`${TAGS.MCP} Rule is not agent-created or could not be verified. Returning UI link.`)
                return formatToolResponse({
                  summary: `Automated deletion is only permitted for rules created by this agent (prefixed with '${AGENT_DISPLAY_NAME_PREFIX}').\n\nThe rule "${displayNameVal || 'this rule'}" must be deleted manually in the Google Admin Console:\n\n${adminConsoleLink}`,
                  data: sc,
                  structuredContent: sc,
                })
              }
            },
          })
        },
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )
}
