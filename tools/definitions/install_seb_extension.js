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
 * @file Tool definition for force-installing the SEB extension.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

const SEB_EXTENSION_ID = 'ekajlcmdfcigmdbphhifahdfjbkciflj'
const INSTALL_TYPE_SCHEMA = 'chrome.users.apps.InstallType'

/**
 * Registers the 'install_seb_extension' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerInstallSebExtensionTool(server, options, sessionState) {
  const { chromePolicyClient } = options
  logger.debug(`${TAGS.MCP} Registering 'install_seb_extension' tool...`)

  server.registerTool(
    'install_seb_extension',
    {
      description: `Force-installs the Secure Enterprise Browser (SEB) extension for a given Organizational Unit.
The SEB extension is REQUIRED for advanced Chrome Enterprise Premium features like data masking.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
        orgUnitId: z
          .string()
          .describe('The ID of the organizational unit.')
          .describe('The ID of the organizational unit where the extension will be force-installed.'),
      },
      outputSchema: z
        .object({
          success: z.boolean(),
          alreadyInstalled: z.boolean(),
          newlyInstalled: z.boolean(),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        /**
         * Handler for force-installing the SEB extension.
         * @param {object} params - The tool parameters.
         * @param {string} [params.customerId] - The Chrome customer ID.
         * @param {string} params.orgUnitId - The organizational unit ID.
         * @param {object} context - The tool execution context.
         * @param {object} context._requestInfo - The request info object.
         * @param {string} context.authToken - The OAuth2 access token.
         * @returns {Promise<object>} The formatted tool response.
         */
        handler: async ({ customerId, orgUnitId }, { _requestInfo, authToken }) => {
          logger.debug(
            `${TAGS.MCP} Calling 'install_seb_extension' with customerId: ${customerId}, orgUnitId: ${orgUnitId}`,
          )

          // Resolve current policy to see if it's already force-installed
          const currentPolicies = await chromePolicyClient.resolvePolicy(
            customerId,
            orgUnitId,
            INSTALL_TYPE_SCHEMA,
            authToken,
          )

          const sebPolicy = currentPolicies?.find(
            p =>
              p.value?.policySchema === INSTALL_TYPE_SCHEMA &&
              p.targetKey?.additionalTargetKeys?.app_id === `chrome:${SEB_EXTENSION_ID}`,
          )

          if (sebPolicy?.value?.value?.appInstallType === 'FORCED') {
            const sc = { success: true, alreadyInstalled: true, newlyInstalled: false }
            return formatToolResponse({
              summary: 'SEB extension is already force-installed on this OU.',
              data: sc,
              structuredContent: sc,
            })
          }

          // Update the policy to set it to FORCED
          const requests = [
            {
              policyTargetKey: {
                targetResource: `orgunits/${orgUnitId}`,
                additionalTargetKeys: {
                  app_id: `chrome:${SEB_EXTENSION_ID}`,
                },
              },
              policyValue: {
                policySchema: INSTALL_TYPE_SCHEMA,
                value: {
                  appInstallType: 'FORCED',
                },
              },
              updateMask: 'appInstallType',
            },
          ]

          await chromePolicyClient.batchModifyPolicy(customerId, orgUnitId, requests, authToken)

          const sc = { success: true, alreadyInstalled: false, newlyInstalled: true }
          return formatToolResponse({
            summary: 'Successfully force-installed SEB extension on this OU. Policy propagation may take time.',
            data: sc,
            structuredContent: sc,
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
