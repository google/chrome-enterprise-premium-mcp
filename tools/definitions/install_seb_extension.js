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
const APP_POLICY_SCHEMA = 'chrome.users.apps.ManagedConfiguration'

/**
 * Registers the 'install_seb_extension' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
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
Optionally configures the BeyondCorp Secure Gateway client routing policy if projectId and gatewayId are provided.
The SEB extension is REQUIRED for advanced Chrome Enterprise Premium features like data masking and Secure Gateway routing.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
        orgUnitId: z
          .string()
          .describe('The ID of the organizational unit where the extension will be force-installed.'),
        projectId: z.string().optional().describe('The Google Cloud project ID for Secure Gateway configuration.'),
        gatewayId: z.string().optional().describe('The Secure Gateway ID to configure for browser routing.'),
        enableServiceDiscovery: z
          .boolean()
          .optional()
          .default(true)
          .describe('Whether to enable Service Discovery in the SEB extension policy. Defaults to true.'),
      },
      outputSchema: z.looseObject({
        success: z.boolean(),
        alreadyInstalled: z.boolean(),
        newlyInstalled: z.boolean(),
        policyConfigured: z.boolean().optional(),
        securityGatewayPolicy: z.looseObject({}).optional(),
      }),
    },
    guardedToolCall(
      {
        /**
         * Handler for force-installing the SEB extension and configuring its policy.
         * @param {object} params - The tool parameters.
         * @param {string} [params.customerId] - The Chrome customer ID.
         * @param {string} params.orgUnitId - The organizational unit ID.
         * @param {string} [params.projectId] - The GCP project ID for Secure Gateway.
         * @param {string} [params.gatewayId] - The Secure Gateway ID.
         * @param {boolean} [params.enableServiceDiscovery] - Whether Service Discovery is enabled.
         * @param {object} context - The tool execution context.
         * @param {object} context._requestInfo - The request info object.
         * @param {string} context.authToken - The OAuth2 access token.
         * @returns {Promise<object>} The formatted tool response.
         */
        handler: async (
          { customerId, orgUnitId, projectId, gatewayId, enableServiceDiscovery = true },
          { _requestInfo, authToken },
        ) => {
          logger.debug(
            `${TAGS.MCP} Calling 'install_seb_extension' with customerId: ${customerId}, orgUnitId: ${orgUnitId}, projectId: ${projectId}, gatewayId: ${gatewayId}`,
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

          const isAlreadyInstalled = sebPolicy?.value?.value?.appInstallType === 'FORCED'
          const requests = []

          if (!isAlreadyInstalled) {
            requests.push({
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
            })
          }

          let securityGatewayConfig = null
          if (projectId && gatewayId) {
            securityGatewayConfig = {
              securityGateway: {
                Value: {
                  authentication: {},
                  context: {
                    resource: `projects/${projectId}/locations/global/securityGateways/${gatewayId}`,
                  },
                  ...(enableServiceDiscovery !== false ? { serviceDiscovery: { routes: {} } } : {}),
                },
              },
            }

            requests.push({
              policyTargetKey: {
                targetResource: `orgunits/${orgUnitId}`,
                additionalTargetKeys: {
                  app_id: `chrome:${SEB_EXTENSION_ID}`,
                },
              },
              policyValue: {
                policySchema: APP_POLICY_SCHEMA,
                value: {
                  managedConfiguration: JSON.stringify(securityGatewayConfig),
                },
              },
              updateMask: 'managedConfiguration',
            })
          }

          if (requests.length === 0) {
            const sc = { success: true, alreadyInstalled: true, newlyInstalled: false, policyConfigured: false }
            return formatToolResponse({
              summary: 'SEB extension is already force-installed on this OU.',
              data: sc,
              structuredContent: sc,
            })
          }

          await chromePolicyClient.batchModifyPolicy(customerId, orgUnitId, requests, authToken)

          const policyConfigured = !!securityGatewayConfig
          const sc = {
            success: true,
            alreadyInstalled: isAlreadyInstalled,
            newlyInstalled: !isAlreadyInstalled,
            policyConfigured,
            ...(securityGatewayConfig ? { securityGatewayPolicy: securityGatewayConfig } : {}),
          }

          let summary = ''
          if (!isAlreadyInstalled && policyConfigured) {
            summary = `Successfully force-installed SEB extension and configured Secure Gateway routing policy for '${gatewayId}' on this OU.`
          } else if (policyConfigured) {
            summary = `SEB extension is already force-installed. Successfully updated Secure Gateway routing policy for '${gatewayId}' on this OU.`
          } else {
            summary = 'Successfully force-installed SEB extension on this OU. Policy propagation may take time.'
          }

          return formatToolResponse({
            summary,
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
