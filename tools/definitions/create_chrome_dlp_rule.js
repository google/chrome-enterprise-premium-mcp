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
import { validateCelCondition } from '../../lib/util/cel_validator.js'

export const CHROME_TRIGGER_MAPPING = {
  FILE_UPLOAD: 'google.workspace.chrome.file.v1.upload',
  FILE_DOWNLOAD: 'google.workspace.chrome.file.v1.download',
  WEB_CONTENT_UPLOAD: 'google.workspace.chrome.web_content.v1.upload',
  PRINT: 'google.workspace.chrome.page.v1.print',
  URL_NAVIGATION: 'google.workspace.chrome.url.v1.navigation',
}

const CHROME_TRIGGER_DESCRIPTIONS = {
  FILE_UPLOAD: 'Scanning files that are uploaded.',
  FILE_DOWNLOAD: 'Scanning files that are downloaded.',
  WEB_CONTENT_UPLOAD: 'Scanning text that is copy-pasted.',
  PRINT: 'Scanning pages that are printed.',
  URL_NAVIGATION: 'Scanning URLs when visited.',
}

const triggerList = Object.keys(CHROME_TRIGGER_MAPPING)
  .map(key => `- ${key}: ${CHROME_TRIGGER_DESCRIPTIONS[key] || ''}`)
  .join('\n')

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
        triggers: z
          .array(z.enum(Object.keys(CHROME_TRIGGER_MAPPING)))
          .describe(`List of Chrome triggers:\n${triggerList}`),
        condition: z
          .string()
          .optional()
          .describe(
            `CEL condition string.

CEL Condition Syntax Guide:
Must follow the pattern "{content_type}.{function}(...)".
Valid content types: all_content, body, subject, title, url, url_category, destination_url, source_url, file_size_in_bytes, file_type, etc.

Trigger Compatibility Rules:
- NAVIGATION / FILE_DOWNLOAD: Use 'url' or 'url_category' only.
- FILE_UPLOAD / WEB_CONTENT_UPLOAD: Use 'source_url' (origin) or 'destination_url' (target).

Function Mapping:
- {content_type}.contains('string'), .starts_with('string'), .ends_with('string'), .equals('string')
- {content_type}.matches_dlp_detector('detector_name')
- {content_type}.matches_regex_detector('detector_name')
- {content_type}.matches_word_list('detector_name')
- url_category.matches_web_category('CATEGORY_NAME') (Note: Only valid on 'url_category', not 'url')

Common Web Categories: ADULT, GAMBLING, FINANCE, ONLINE_COMMUNITIES__SOCIAL_NETWORKS, INTERNET_AND_TELECOM__FILE_SHARING_AND_HOSTING
Operators: && (AND), || (OR), ! (NOT).
Example: "all_content.contains('secret') && !url_category.matches_web_category('ONLINE_COMMUNITIES__SOCIAL_NETWORKS')"`,
          ),
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
            const validationResult = validateCelCondition(condition, triggers)
            if (!validationResult.isValid) {
              throw new Error(`CEL condition validation failed:\n- ${validationResult.errors.join('\n- ')}`)
            }
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

          let createdPolicy
          try {
            createdPolicy = await cloudIdentityClient.createDlpRule(
              customerId,
              orgUnitId,
              ruleConfig,
              validateOnly,
              authToken,
            )
          } catch (error) {
            // Error 7016: Request contains invalid argument(s) often happens due to incompatible CEL functions with triggers.
            if (error.message && (error.message.includes('7016') || error.message.includes('INVALID_ARGUMENT'))) {
              let errorDetails = 'This may be due to an incompatible CEL function or a malformed condition string.'
              if (condition && condition.includes('.matches_web_category')) {
                const hasNavTrigger = fullTriggers.includes('google.workspace.chrome.url.v1.navigation')
                if (!hasNavTrigger) {
                  errorDetails =
                    "The CEL function 'matches_web_category' requires the 'NAVIGATION' trigger, which was not provided in the request."
                } else {
                  errorDetails =
                    "The CEL condition uses 'matches_web_category', but the category string might be invalid or unsupported by the API."
                }
              }
              throw new Error(`${error.message}\nError Details: ${errorDetails}`)
            }
            throw error
          }

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
