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
 * @file Tool definition for checking the status of the Endpoint Verification extension.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

const EV_EXTENSION_ID = 'callobklhcbilhphinckomhgkigmfocg'
const INSTALL_TYPE_SCHEMA = 'chrome.users.apps.InstallType'

/**
 * Registers the 'check_ev_extension_status' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerCheckEvExtensionStatusTool(server, options, sessionState) {
  const { chromePolicyClient } = options
  logger.debug(`${TAGS.MCP} Registering 'check_ev_extension_status' tool...`)

  server.registerTool(
    'check_ev_extension_status',
    {
      description: `Checks if the Endpoint Verification (EV) extension is force-installed for a given Organizational Unit.
The EV extension is REQUIRED for gathering device posture to use Context-Aware Access (CAA) levels.
If the extension is NOT force-installed, you MUST recommend that the administrator force-installs it and explain that it is required for Context-Aware Access (CAA) levels to be enforced.`,
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
        policies: z.array(z.looseObject({})),
      }),
    },
    guardedToolCall(
      {
        handler: async ({ customerId, orgUnitId }, { _requestInfo, authToken }) => {
          logger.debug(
            `${TAGS.MCP} Calling 'check_ev_extension_status' with customerId: ${customerId}, orgUnitId: ${orgUnitId}`,
          )

          const policies = await chromePolicyClient.resolvePolicy(customerId, orgUnitId, INSTALL_TYPE_SCHEMA, authToken)

          const evPolicy = policies?.find(
            p =>
              p.value?.policySchema === INSTALL_TYPE_SCHEMA &&
              p.targetKey?.additionalTargetKeys?.app_id === `chrome:${EV_EXTENSION_ID}`,
          )
          const isInstalled = evPolicy?.value?.value?.appInstallType === 'FORCED'

          const targetResource = evPolicy?.targetKey?.targetResource
          const sourceResource = evPolicy?.sourceKey?.targetResource

          const targetOrgUnitId = targetResource ? targetResource.split('/').pop() : undefined
          const sourceOrgUnitId = sourceResource ? sourceResource.split('/').pop() : undefined
          const inherited = targetOrgUnitId && sourceOrgUnitId ? targetOrgUnitId !== sourceOrgUnitId : undefined

          const sc = {
            isInstalled,
            extensionId: EV_EXTENSION_ID,
            inherited,
            sourceOrgUnitId,
            targetOrgUnitId,
            policies: policies || [],
          }
          let summary = isInstalled
            ? `Endpoint Verification extension (\`${EV_EXTENSION_ID}\`) is force-installed on this OU.`
            : `Endpoint Verification extension (\`${EV_EXTENSION_ID}\`) is NOT force-installed on this OU. Device posture sync may not work.`

          if (isInstalled && inherited !== undefined) {
            summary += inherited
              ? ` (Inherited from parent OU: \`${sourceOrgUnitId}\`)`
              : ` (Directly applied to this OU)`
          }

          return formatToolResponse({ summary, data: sc, structuredContent: sc })
        },
      },
      options,
      sessionState,
    ),
  )
}
