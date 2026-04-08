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
 * @fileoverview Tool definition for force-installing the SEB extension.
 */

import { guardedToolCall, getAuthToken, inputSchemas, outputSchemas } from '../utils.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

const SEB_EXTENSION_ID = 'ekajlcmdfcigmdbphhifahdfjbkciflj'
const INSTALL_TYPE_SCHEMA = 'chrome.users.apps.InstallType'

/**
 * Registers the 'install_seb_extension' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerInstallSebExtensionTool(server, options, sessionState) {
  const { chromePolicyClient } = options
  logger.debug(`${TAGS.MCP} Registering 'install_seb_extension' tool...`)

  server.registerTool(
    'install_seb_extension',
    {
      description:
        'Force-installs the Secure Enterprise Browser (SEB) extension for a given Organizational Unit. Required for data masking. Returns a user-friendly text summary and an embedded JSON resource with the status.',
      inputSchema: {
        customerId: inputSchemas.customerId,
        orgUnitId: inputSchemas.orgUnitId.describe(
          'The ID of the organizational unit where the extension will be force-installed.',
        ),
      },
      outputSchema: outputSchemas.successMessage,
    },
    guardedToolCall(
      {
        handler: async ({ customerId, orgUnitId }, { requestInfo }) => {
          logger.debug(
            `${TAGS.MCP} Calling 'install_seb_extension' with customerId: ${customerId}, orgUnitId: ${orgUnitId}`,
          )
          const authToken = getAuthToken(requestInfo)

          // 1. Resolve current policy to see if it's already force-installed
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
            return {
              content: [
                {
                  type: 'text',
                  text: `The Secure Enterprise Browser (SEB) extension is already force-installed for this Organizational Unit.`,
                },
              ],
            }
          }

          // 2. Update the policy to set it to FORCED
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

          logger.debug(`${TAGS.MCP} Successfully updated SEB extension policy.`)
          return {
            content: [
              {
                type: 'text',
                text: `Successfully force-installed the Secure Enterprise Browser (SEB) extension for this Organizational Unit. It may take some time for the policy to propagate to all browsers.`,
              },
            ],
            structuredContent: {
              success: true,
              newlyInstalled: true,
            },
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
