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
 * @fileoverview Tool definition for creating Chrome-specific DLP rules.
 */

import { z } from 'zod'

import { guardedToolCall, getAuthToken, inputSchemas, outputSchemas } from '../utils.js'
import { TAGS, MASK_TYPES } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

export const CHROME_TRIGGER_MAPPING = {
  FILE_UPLOAD: 'google.workspace.chrome.file.v1.upload',
  FILE_DOWNLOAD: 'google.workspace.chrome.file.v1.download',
  WEB_CONTENT_UPLOAD: 'google.workspace.chrome.web_content.v1.upload',
  PRINT: 'google.workspace.chrome.page.v1.print',
  URL_NAVIGATION: 'google.workspace.chrome.url.v1.navigation',
}

const CHROME_ACTION_TYPES = {
  BLOCK: 'BLOCK',
  WARN: 'WARN',
  AUDIT: 'AUDIT',
}

/**
 * Registers the 'create_chrome_dlp_rule' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerCreateChromeDlpRuleTool(server, options, sessionState) {
  const { cloudIdentityClient } = options
  logger.debug(`${TAGS.MCP} Registering 'create_chrome_dlp_rule' tool...`)

  server.registerTool(
    'create_chrome_dlp_rule',
    {
      description: `Creates a new Chrome DLP rule for a specific Organizational Unit.
This tool is specialized for browser-level protection (e.g., uploads, downloads, printing).`,
      inputSchema: {
        customerId: inputSchemas.customerId,
        orgUnitId: inputSchemas.orgUnitId.describe('The target Organizational Unit ID'),
        displayName: z.string().describe('Name of the rule'),
        description: z.string().optional().describe('Description of the rule'),
        triggers: z.array(z.enum(Object.keys(CHROME_TRIGGER_MAPPING))).describe('List of Chrome triggers.'),
        condition: z.string().optional().describe(`CEL condition string (e.g. "all_content.contains('secret')")`),
        action: z
          .enum([CHROME_ACTION_TYPES.BLOCK, CHROME_ACTION_TYPES.WARN, CHROME_ACTION_TYPES.AUDIT])
          .describe('Action to take when the rule is triggered'),
        state: z.enum(['ACTIVE', 'INACTIVE']).optional().describe('Rule state (defaults to ACTIVE)'),
        validateOnly: z.boolean().optional().describe('If true, the request is validated but not created.'),
        customMessage: z
          .string()
          .optional()
          .describe(`Custom message to display to the user when the rule is triggered.`),
        watermarkMessage: z.string().optional().describe(`Watermark message to display when the rule is triggered.`),
        blockScreenshot: z.boolean().optional().describe(`Whether to block screenshots when the rule is triggered.`),
        saveContent: z.boolean().optional().describe(`Whether to save the content that triggered the rule.`),
        dataMasking: z
          .array(
            z.object({
              maskType: z.enum(Object.values(MASK_TYPES)).describe('The type of masking to apply.'),
              resourceName: z.string().describe('The resource name of the detector (e.g. US_SOCIAL_SECURITY_NUMBER).'),
              displayName: z.string().describe('The display name for the detector in the UI.'),
            }),
          )
          .optional()
          .describe('List of data masking configurations.'),
      },
      outputSchema: outputSchemas.singlePolicy,
    },

    guardedToolCall(
      {
        transform: params => {
          const newDisplayName = `🤖 ${params.displayName}`
          return { ...params, displayName: newDisplayName }
        },
        handler: async (params, { requestInfo }) => {
          logger.debug(`${TAGS.MCP} Calling 'create_chrome_dlp_rule' with params: ${JSON.stringify(params)}`)
          const {
            customerId,
            orgUnitId,
            displayName,
            description,
            triggers,
            condition,
            action,
            state,
            validateOnly,
            customMessage,
            watermarkMessage,
            blockScreenshot,
            saveContent,
            dataMasking,
          } = params

          const authToken = getAuthToken(requestInfo)
          const fullTriggers = triggers.map(t => CHROME_TRIGGER_MAPPING[t])

          const ruleConfig = {
            displayName,
            description,
            triggers: fullTriggers,
            state: state || 'ACTIVE',
          }

          if (condition) {
            ruleConfig.condition = {
              contentCondition: condition,
            }
          }

          const actionParams = {}
          if (customMessage) {
            actionParams.customEndUserMessage = {
              unsafeHtmlMessageBody: customMessage,
            }
          }
          if (watermarkMessage) {
            actionParams.watermarkMessage = watermarkMessage
          }
          if (blockScreenshot) {
            actionParams.blockScreenshot = blockScreenshot
          }
          if (saveContent) {
            actionParams.saveContent = saveContent
          }
          if (dataMasking?.length) {
            actionParams.dataMasking = {
              regex_detector: dataMasking.map(dm => ({
                mask_type: dm.maskType,
                resource_name: dm.resourceName,
                display_name: dm.displayName,
              })),
            }
          }

          switch (action) {
            case CHROME_ACTION_TYPES.BLOCK:
              ruleConfig.action = { chromeAction: { blockContent: {} } }
              if (Object.keys(actionParams).length > 0) {
                ruleConfig.action.chromeAction.blockContent.actionParams = actionParams
              }
              break
            case CHROME_ACTION_TYPES.WARN:
              ruleConfig.action = { chromeAction: { warnUser: {} } }
              if (Object.keys(actionParams).length > 0) {
                ruleConfig.action.chromeAction.warnUser.actionParams = actionParams
              }
              break
            case CHROME_ACTION_TYPES.AUDIT:
              ruleConfig.action = { chromeAction: { auditOnly: {} } }
              if (Object.keys(actionParams).length > 0) {
                ruleConfig.action.chromeAction.auditOnly.actionParams = actionParams
              }
              break
          }

          const createdPolicy = await cloudIdentityClient.createDlpRule(
            customerId,
            orgUnitId,
            ruleConfig,
            validateOnly,
            authToken,
          )

          if (validateOnly) {
            logger.debug(`${TAGS.MCP} Successfully validated Chrome DLP rule.`)
            return {
              content: [
                {
                  type: 'text',
                  text: 'Chrome DLP rule validation successful. The rule was not created.',
                },
              ],
            }
          }

          logger.debug(`${TAGS.MCP} Successfully created Chrome DLP rule.`)
          return {
            content: [
              {
                type: 'text',
                text: `Successfully created Chrome DLP rule: ${createdPolicy.name}\n\nDetails:\n${JSON.stringify(createdPolicy, null, 2)}`,
              },
            ],
          }
        },
      },
      options,
      sessionState,
    ),
  )
}
