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
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { validateCelCondition, validateActionParameters } from '../../lib/util/cel_validator.js'
import {
  CEL_SYNTAX_GUIDE,
  UNIVERSAL_CONTENT_TYPES,
  NAVIGATION_CONTENT_TYPES,
  PASTE_CONTENT_TYPES,
  FILE_CONTENT_TYPES,
  CEL_FUNCTIONS,
  CEL_COMPATIBILITY_RULES,
  URL_RISK_LEVELS,
  CHROME_CONTEXTS,
  URL_CATEGORY_METADATA,
  POLICY_STATES,
  MASK_TYPES,
  VALID_WEB_CATEGORIES,
  CHROME_TRIGGERS,
  CHROME_ACTION_TYPES,
  ACTION_PARAMETER_CONSTRAINTS,
} from '../../lib/util/chrome_dlp_constants.js'

const triggerList = Object.entries(CHROME_TRIGGERS)
  .map(([key, obj]) => `- ${key}: ${obj.description}`)
  .join('\n')

const syntaxGuideList = CEL_SYNTAX_GUIDE.map(item => {
  const exampleLines = item.examples.map(ex => `   Example: "${ex}"`).join('\n')
  return `${item.rule}\n${exampleLines}`
}).join('\n')

const universalTypeList = Object.entries(UNIVERSAL_CONTENT_TYPES)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join('\n')

const navigationTypeList = Object.entries(NAVIGATION_CONTENT_TYPES)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join('\n')

const pasteTypeList = Object.entries(PASTE_CONTENT_TYPES)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join('\n')

const fileTypeList = Object.entries(FILE_CONTENT_TYPES)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join('\n')

const functionList = Object.entries(CEL_FUNCTIONS)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join('\n')

const compatibilityList = Object.entries(CEL_COMPATIBILITY_RULES)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join('\n')

const actionConstraintList = Object.entries(ACTION_PARAMETER_CONSTRAINTS)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join('\n')

const enumReferenceMap = {
  source_chrome_context: CHROME_CONTEXTS,
}

const referenceValueList = Object.entries(enumReferenceMap)
  .map(([key, enumObj]) => {
    const valuesStr = Object.values(enumObj)
      .map(v => `'${v.value}' (${v.description})`)
      .join(', ')
    return `- ${key}: ${valuesStr}`
  })
  .join('\n')

const webCategoryList = URL_CATEGORY_METADATA.commonValuesDescription

const maskTypeList = Object.values(MASK_TYPES)
  .map(m => `- ${m.value}: ${m.description}`)
  .join('\n')

const policyStateList = Object.values(POLICY_STATES)
  .map(s => `- ${s.value}: ${s.description}`)
  .join('\n')

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
        triggers: z.array(z.enum(Object.keys(CHROME_TRIGGERS))).describe(`List of Chrome triggers:\n${triggerList}`),
        condition: z
          .string()
          .optional()
          .describe(
            `CEL condition string.
CEL Condition Syntax Guide:
${syntaxGuideList}

Valid Content Types (Universal):
${universalTypeList}

Valid Content Types (Trigger Specific):
*Navigation Only*:
${navigationTypeList}

*Paste (WEB_CONTENT_UPLOAD) Only*:
${pasteTypeList}

*File (UPLOAD/DOWNLOAD/PRINT) Only*:
${fileTypeList}

Valid Functions:
${functionList}

Value References (for enums/categories):
${referenceValueList}

Web Categories (for url_category):
${webCategoryList}

Trigger Compatibility Rules:
${compatibilityList}

Multi-Trigger Logic:
- If multiple triggers are selected, a field or function is valid if it is supported by AT LEAST ONE of those triggers.
- Example: 'all_content' is supported if you select both 'URL_NAVIGATION' (which doesn't support it) and 'WEB_CONTENT_UPLOAD' (which does).

Action Parameter Compatibility Rules:
${actionConstraintList}`,
          ),
        action: z
          .enum([CHROME_ACTION_TYPES.BLOCK, CHROME_ACTION_TYPES.WARN, CHROME_ACTION_TYPES.AUDIT])
          .describe('Action to take when the rule is triggered'),
        state: z
          .enum(Object.values(POLICY_STATES).map(s => s.value))
          .optional()
          .describe(`Rule state (defaults to ACTIVE):\n${policyStateList}`),
        customMessage: z
          .string()
          .optional()
          .describe(
            `Custom message to display to the user when the rule is triggered. Note: This field is not applicable to 'AUDIT' actions.`,
          ),
        watermarkMessage: z
          .string()
          .optional()
          .describe(
            `Watermark message to display when the rule is triggered. Note: This field is only applicable to 'WARN' and 'AUDIT' actions; it is ignored for 'BLOCK' actions.`,
          ),
        blockScreenshot: z
          .boolean()
          .optional()
          .describe(
            `Whether to block screenshots when the rule is triggered. Note: This field is only applicable to 'WARN' and 'AUDIT' actions; it is ignored for 'BLOCK' actions.`,
          ),
        saveContent: z.boolean().optional().describe(`Whether to save the content that triggered the rule.`),
        validateOnly: z
          .boolean()
          .optional()
          .describe('If true, validates the rule configuration without actually creating it.'),
        dataMasking: z
          .array(
            z.object({
              maskType: z
                .enum(Object.values(MASK_TYPES).map(m => m.value))
                .describe(`The type of masking to apply:\n${maskTypeList}`),
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
          const fullTriggers = triggers.map(t => CHROME_TRIGGERS[t].value)

          const ruleConfig = {
            displayName,
            description,
            triggers: fullTriggers,
            state: state || POLICY_STATES.ACTIVE.value,
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

          // Validate action-parameter compatibility based on rule message constraints
          const actionValidation = validateActionParameters(action, {
            customMessage,
            watermarkMessage,
            blockScreenshot,
          })
          if (!actionValidation.isValid) {
            throw new Error(actionValidation.errors.join('\n- '))
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
              regexDetector: dataMasking.map(dm => ({
                maskType: dm.maskType,
                resourceName: dm.resourceName,
                displayName: dm.displayName,
              })),
            }
          }

          const chromeAction = {}
          const hasActionParams = Object.keys(actionParams).length > 0

          switch (action) {
            case CHROME_ACTION_TYPES.BLOCK:
              chromeAction.blockContent = hasActionParams ? { actionParams } : {}
              break
            case CHROME_ACTION_TYPES.WARN:
              chromeAction.warnUser = hasActionParams ? { actionParams } : {}
              break
            case CHROME_ACTION_TYPES.AUDIT:
              chromeAction.auditOnly = hasActionParams ? { actionParams } : {}
              break
            default:
              throw new Error(`Unsupported action type: ${action}`)
          }

          ruleConfig.action = {
            chromeAction: chromeAction,
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
              // Invalid argument error the validators didn't catch
              let errorDetails =
                'This may be due to an incompatible CEL function, a malformed condition string, or an unsupported field/value combination.'
              throw new Error(`${error.message}\n\n${errorDetails}`)
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
