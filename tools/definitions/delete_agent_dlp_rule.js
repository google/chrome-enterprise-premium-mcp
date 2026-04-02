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
 * @fileoverview Tool definition for deleting DLP rules.
 */

import { z } from 'zod'
import { guardedToolCall, getAuthToken, inputSchemas, outputSchemas } from '../utils.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { AGENT_DISPLAY_NAME_PREFIX, ADMIN_CONSOLE_DLP_RULE_LINK_TEMPLATE } from '../../lib/util/chrome_dlp_constants.js'

/**
 * Registers the 'delete_agent_dlp_rule' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerDeleteAgentDlpRuleTool(server, options, sessionState) {
  const { cloudIdentityClient } = options
  logger.debug(`${TAGS.MCP} Registering 'delete_agent_dlp_rule' tool...`)

  server.registerTool(
    'delete_agent_dlp_rule',
    {
      description: `Deletes an agent-created DLP rule (prefixed with '${AGENT_DISPLAY_NAME_PREFIX}'). To manually manage any rule, use: ${ADMIN_CONSOLE_DLP_RULE_LINK_TEMPLATE}`,
      inputSchema: {
        policyName: inputSchemas.ruleResourceName,
      },
      outputSchema: outputSchemas.successMessage,
    },
    guardedToolCall(
      {
        handler: async ({ policyName }, { requestInfo }) => {
          logger.debug(`${TAGS.MCP} Calling 'delete_agent_dlp_rule' with policyName: ${policyName}`)
          const authToken = getAuthToken(requestInfo)

          let rule
          try {
            rule = await cloudIdentityClient.getDlpRule(policyName, authToken)
          } catch (error) {
            logger.error(`${TAGS.MCP} Failed to fetch rule details for ${policyName}: ${error.message}`)
            // Fallback to providing the link if we can't verify the rule
          }

          const displayName = rule?.setting?.value?.displayName || ''
          const isAgentCreated = displayName.startsWith(AGENT_DISPLAY_NAME_PREFIX)

          if (isAgentCreated) {
            await cloudIdentityClient.deleteDlpRule(policyName, authToken)
            logger.debug(`${TAGS.MCP} Successfully deleted agent-created DLP rule: ${policyName}`)
            return {
              content: [
                {
                  type: 'text',
                  text: `Successfully deleted Chrome DLP rule: ${policyName} (Display Name: "${displayName}")`,
                },
              ],
            }
          } else {
            const encodedPolicyName = encodeURIComponent(policyName)
            const adminConsoleLink = ADMIN_CONSOLE_DLP_RULE_LINK_TEMPLATE.replace(
              '{URL_ENCODED_RESOURCE_NAME}',
              encodedPolicyName,
            )

            logger.debug(`${TAGS.MCP} Rule is not agent-created or could not be verified. Returning UI link.`)
            return {
              content: [
                {
                  type: 'text',
                  text: `Automated deletion is only permitted for rules created by this agent (prefixed with '${AGENT_DISPLAY_NAME_PREFIX}').

The rule "${displayName || policyName}" must be deleted manually in the Google Admin Console:

${adminConsoleLink}`,
                },
              ],
            }
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
