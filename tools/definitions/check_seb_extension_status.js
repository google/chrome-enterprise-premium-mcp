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

/**
 * Registers the 'check_seb_extension_status' tool with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/chrome_policy_client.js').ChromePolicyClient} options.chromePolicyClient - The Chrome Policy client instance.
 * @param {object} sessionState - The session state object for caching.
 * @returns {void}
 */
export function registerCheckSebExtensionStatusTool(server, options, sessionState) {
  const { chromePolicyClient } = options
  logger.debug(`${TAGS.MCP} Registering 'check_seb_extension_status' tool...`)

  server.registerTool(
    'check_seb_extension_status',
    {
      description: `Checks if the Secure Enterprise Browser (SEB) extension is force-installed for a given Organizational Unit.
The SEB extension is REQUIRED for advanced Chrome Enterprise Premium features like data masking. If not installed, use 'install_seb_extension' to fix it.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
        orgUnitId: z
          .string()
          .describe('The ID of the organizational unit.')
          .describe('The ID of the organizational unit to check.'),
      },
      outputSchema: z
        .object({
          isInstalled: z.boolean(),
          extensionId: z.string(),
          policies: z.array(z.object({}).passthrough()),
        })
        .passthrough(),
    },
    guardedToolCall(
      {
        handler: async ({ customerId, orgUnitId }, { _requestInfo, authToken }) => {
          logger.debug(
            `${TAGS.MCP} Calling 'check_seb_extension_status' with customerId: ${customerId}, orgUnitId: ${orgUnitId}`,
          )

          const policies = await chromePolicyClient.resolvePolicy(customerId, orgUnitId, INSTALL_TYPE_SCHEMA, authToken)

          const sebPolicy = policies?.find(
            p =>
              p.value?.policySchema === INSTALL_TYPE_SCHEMA &&
              p.targetKey?.additionalTargetKeys?.app_id === `chrome:${SEB_EXTENSION_ID}`,
          )
          const isInstalled = sebPolicy?.value?.value?.appInstallType === 'FORCED'

          const sc = { isInstalled, extensionId: SEB_EXTENSION_ID, policies: policies || [] }
          const summary = isInstalled
            ? `SEB extension (\`${SEB_EXTENSION_ID}\`) is force-installed on this OU.`
            : `SEB extension (\`${SEB_EXTENSION_ID}\`) is NOT force-installed on this OU. Data masking may not work.`
          return formatToolResponse({ summary, data: sc, structuredContent: sc })
        },
      },
      options,
      sessionState,
    ),
  )
}
