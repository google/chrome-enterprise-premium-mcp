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
 * @file Tool definition for checking the status of the SEB extension.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

const SEB_EXTENSION_ID = 'ekajlcmdfcigmdbphhifahdfjbkciflj'
const INSTALL_TYPE_SCHEMA = 'chrome.users.apps.InstallType'
const APP_POLICY_SCHEMA = 'chrome.users.apps.ManagedConfiguration'

/**
 * Registers the 'check_seb_extension_status' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerCheckSebExtensionStatusTool(server, options, sessionState) {
  const { chromePolicyClient } = options
  logger.debug(`${TAGS.MCP} Registering 'check_seb_extension_status' tool...`)

  server.registerTool(
    'check_seb_extension_status',
    {
      description: `Checks if the Secure Enterprise Browser (SEB) extension is force-installed and verifies its client routing policy for a given Organizational Unit.
The SEB extension is REQUIRED for advanced Chrome Enterprise Premium features like data masking and BeyondCorp Secure Gateway routing. If not installed or configured, use 'install_seb_extension' to configure it.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
        orgUnitId: z.string().describe('The ID of the organizational unit to check.'),
      },
      outputSchema: z.looseObject({
        isInstalled: z.boolean(),
        extensionId: z.string(),
        inherited: z.boolean().optional(),
        sourceOrgUnitId: z.string().optional(),
        targetOrgUnitId: z.string().optional(),
        securityGatewayPolicy: z
          .looseObject({
            configured: z.boolean(),
            gatewayResource: z.string().optional(),
            serviceDiscoveryEnabled: z.boolean().optional(),
            policy: z.looseObject({}).optional(),
          })
          .optional(),
        policies: z.array(z.looseObject({})),
      }),
    },
    guardedToolCall(
      {
        isMutating: false,
        handler: async ({ customerId, orgUnitId }, { _requestInfo, authToken }) => {
          logger.debug(
            `${TAGS.MCP} Calling 'check_seb_extension_status' with customerId: ${customerId}, orgUnitId: ${orgUnitId}`,
          )

          const [policies, appPolicies] = await Promise.all([
            chromePolicyClient.resolvePolicy(customerId, orgUnitId, INSTALL_TYPE_SCHEMA, authToken),
            chromePolicyClient.resolvePolicy(customerId, orgUnitId, APP_POLICY_SCHEMA, authToken).catch(err => {
              logger.debug(`${TAGS.API} Failed to resolve ${APP_POLICY_SCHEMA}: ${err.message}`)
              return []
            }),
          ])

          const sebPolicy = policies?.find(
            p =>
              p.value?.policySchema === INSTALL_TYPE_SCHEMA &&
              p.targetKey?.additionalTargetKeys?.app_id === `chrome:${SEB_EXTENSION_ID}`,
          )
          const isInstalled = sebPolicy?.value?.value?.appInstallType === 'FORCED'

          const targetResource = sebPolicy?.targetKey?.targetResource
          const sourceResource = sebPolicy?.sourceKey?.targetResource

          const targetOrgUnitId = targetResource ? targetResource.split('/').pop() : undefined
          const sourceOrgUnitId = sourceResource ? sourceResource.split('/').pop() : undefined
          const inherited = targetOrgUnitId && sourceOrgUnitId ? targetOrgUnitId !== sourceOrgUnitId : undefined

          const appPolicyEntry = appPolicies?.find(
            p =>
              p.value?.policySchema === APP_POLICY_SCHEMA &&
              p.targetKey?.additionalTargetKeys?.app_id === `chrome:${SEB_EXTENSION_ID}`,
          )

          let rawConfig = appPolicyEntry?.value?.value?.managedConfiguration || appPolicyEntry?.value?.value?.appPolicy
          if (typeof rawConfig === 'string') {
            try {
              rawConfig = JSON.parse(rawConfig)
            } catch {
              // keep as-is if parsing fails
            }
          }

          const sgValue =
            rawConfig?.securityGateway?.Value || rawConfig?.securityGateway?.value || rawConfig?.securityGateway
          const gatewayResource = sgValue?.context?.resource
          const serviceDiscoveryEnabled = sgValue?.serviceDiscovery !== undefined

          const securityGatewayPolicy = sgValue
            ? {
                configured: true,
                gatewayResource,
                serviceDiscoveryEnabled,
                policy: rawConfig,
              }
            : {
                configured: false,
              }

          const sc = {
            isInstalled,
            extensionId: SEB_EXTENSION_ID,
            inherited,
            sourceOrgUnitId,
            targetOrgUnitId,
            securityGatewayPolicy,
            policies: policies || [],
          }

          let summary = isInstalled
            ? `SEB extension (\`${SEB_EXTENSION_ID}\`) is force-installed on this OU.`
            : `SEB extension (\`${SEB_EXTENSION_ID}\`) is NOT force-installed on this OU. Data masking and Secure Gateway routing may not work.`

          if (isInstalled && inherited !== undefined) {
            summary += inherited
              ? ` (Inherited from parent OU: \`${sourceOrgUnitId}\`)`
              : ` (Directly applied to this OU)`
          }

          if (securityGatewayPolicy.configured) {
            summary += ` Secure Gateway routing is configured for '${gatewayResource}' (Service Discovery: ${serviceDiscoveryEnabled ? 'enabled' : 'disabled'}).`
          } else if (isInstalled) {
            summary += ' No Secure Gateway routing policy is configured on this extension.'
          }

          return formatToolResponse({ summary, data: sc, structuredContent: sc })
        },
      },
      options,
      sessionState,
    ),
  )
}
