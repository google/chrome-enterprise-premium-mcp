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
 * @file Tool definition for creating Chrome-specific DLP rules.
 */

import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  guardedToolCall,
  formatToolResponse,
  safeFormatResponse,
  GuardedToolOptions,
  SessionState,
  McpToolResponse,
} from '../utils/wrapper.js'
import { commonOutputSchemas } from './shared.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import {
  validateCelCondition,
  validateActionParameters,
  validateMcpSafetyConstraints,
} from '../../lib/util/cel_validator.js'
import {
  CHROME_TRIGGERS,
  CHROME_ACTION_TYPES,
  ACTION_PARAMETER_CONSTRAINTS,
  WORKSPACE_RULE_LIMITS,
  AGENT_DISPLAY_NAME_PREFIX,
  MCP_SAFETY_CONSTRAINTS,
  POLICY_STATES,
  MASK_TYPES,
} from '../../lib/util/chrome_dlp_constants.js'
import { isObject, getString, getObject } from '../../lib/util/helpers.js'

const triggerList = Object.entries(CHROME_TRIGGERS)
  .map(([key, obj]) => `- ${key}: ${obj.description}`)
  .join('\n')

const maskTypeList = Object.values(MASK_TYPES)
  .map(m => `- ${m.value}: ${m.description}`)
  .join('\n')

const policyStateList = Object.values(POLICY_STATES)
  .map(s => `- ${s.value}: ${s.description}`)
  .join('\n')

// User provides name without prefix. Max allowed length for user is:
// (Hard Limit - Prefix Length) rounded down to nearest multiple of 5.
const USER_DISPLAY_NAME_MAX_LENGTH =
  Math.floor((WORKSPACE_RULE_LIMITS.NAME_MAX_LENGTH - AGENT_DISPLAY_NAME_PREFIX.length) / 5) * 5

// Use standard const assertions to allow strict Zod enum inference
const triggerKeys = [
  'ON_FILE_ATTACHED',
  'ON_FILE_DOWNLOAD',
  'ON_BULK_TEXT_ENTRY',
  'ON_PRINT',
  'ON_REALTIME_URL_NAVIGATION',
  'ON_SECURITY_EVENT',
] as const

const actionValues = ['BLOCK', 'WARN', 'AUDIT'] as const

const stateValues = ['ACTIVE', 'INACTIVE'] as const

const maskTypeValues = ['LAST_4_CHARS', 'FIRST_4_CHARS', 'ALL_CHARS'] as const

const CreateDlpRuleSchema = z.object({
  customerId: z.string().optional(),
  orgUnitId: z.string(),
  displayName: z.string().max(USER_DISPLAY_NAME_MAX_LENGTH),
  description: z.string().max(WORKSPACE_RULE_LIMITS.DESCRIPTION_MAX_LENGTH).optional(),
  triggers: z.array(z.enum(triggerKeys)),
  condition: z.string().optional(),
  action: z.enum(actionValues),
  state: z.enum(stateValues).optional(),
  customMessage: z.string().optional(),
  watermarkMessage: z.string().optional(),
  blockScreenshot: z.boolean().optional(),
  saveContent: z.boolean().optional(),
  dataMasking: z
    .object({
      regexDetectors: z
        .array(
          z.object({
            maskType: z.enum(maskTypeValues),
            resourceName: z.string().startsWith('policies/'),
            displayName: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
})

type CreateDlpRuleParams = z.infer<typeof CreateDlpRuleSchema>

/**
 * Registers the 'create_chrome_dlp_rule' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerCreateChromeDlpRuleTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const cloudIdentityClient = apiClients?.cloudIdentity
  logger.debug(`${TAGS.MCP} Registering 'create_chrome_dlp_rule' tool...`)

  server.registerTool(
    'create_chrome_dlp_rule',
    {
      description: `Creates a new Chrome DLP rule for a specific Organizational Unit.
Applies browser-level protection (uploads, downloads, printing).
${MCP_SAFETY_CONSTRAINTS.ACTIVE_BLOCK_RESTRICTION}

To ensure technical accuracy and verify trigger compatibility, you should retrieve the full technical reference using 'get_document' for '11-dlp-rule-reference' before using this tool.`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
        orgUnitId: z.string().describe('The target Organizational Unit ID'),
        displayName: z
          .string()
          .max(USER_DISPLAY_NAME_MAX_LENGTH)
          .describe(
            `The display name of the rule. Will be automatically prefixed with '${AGENT_DISPLAY_NAME_PREFIX}'.`,
          ),
        description: z
          .string()
          .max(WORKSPACE_RULE_LIMITS.DESCRIPTION_MAX_LENGTH)
          .optional()
          .describe('Description of the rule.'),
        triggers: z.array(z.enum(triggerKeys)).describe(`List of Chrome triggers:\n${triggerList}`),
        condition: z
          .string()
          .optional()
          .describe(
            "CEL condition string. To ensure technical accuracy and verify trigger compatibility, you should retrieve the full technical reference using 'get_document' for '11-dlp-rule-reference' before formulating a condition.",
          ),
        action: z
          .enum([CHROME_ACTION_TYPES.BLOCK.value, CHROME_ACTION_TYPES.WARN.value, CHROME_ACTION_TYPES.AUDIT.value] as [
            string,
            ...string[],
          ])
          .describe(
            'Action to take when the rule is triggered. AUDIT mode is silent and logs events without notifying or blocking the user.',
          ),
        state: z.enum(stateValues).optional().describe(`Rule state (defaults to ACTIVE):\n${policyStateList}`),
        customMessage: z
          .string()
          .optional()
          .describe(`Custom message to display to the user. ${ACTION_PARAMETER_CONSTRAINTS.CUSTOM_MESSAGE_SUPPORT}`),
        watermarkMessage: z
          .string()
          .optional()
          .describe(
            `Watermark message to display when the rule is triggered. ${ACTION_PARAMETER_CONSTRAINTS.WATERMARK_SUPPORT}`,
          ),
        blockScreenshot: z
          .boolean()
          .optional()
          .describe(
            `Whether to block screenshots when the rule is triggered. ${ACTION_PARAMETER_CONSTRAINTS.SCREENSHOT_SUPPORT}`,
          ),
        saveContent: z.boolean().optional().describe(`Whether to save the content that triggered the rule.`),
        dataMasking: z
          .object({
            regexDetectors: z
              .array(
                z.object({
                  maskType: z.enum(maskTypeValues).describe(`The type of masking to apply:\n${maskTypeList}`),
                  resourceName: z
                    .string()
                    .startsWith('policies/')
                    .describe('The resource name of the detector (e.g. policies/akajj264apk5psphei)'),
                  displayName: z.string().describe('The display name for the detector in the UI.'),
                }),
              )
              .optional(),
          })
          .optional()
          .describe(
            `Data masking configurations (currently only regex detectors are supported). ${ACTION_PARAMETER_CONSTRAINTS.DATA_MASKING_SUPPORT}`,
          ),
      },
      outputSchema: z
        .object({
          dlpRule: commonOutputSchemas.cloudIdentityPolicy,
        })
        .passthrough(),
    },

    guardedToolCall(
      {
        transform: (params: Record<string, unknown>): Record<string, unknown> => {
          const prefix = AGENT_DISPLAY_NAME_PREFIX
          const displayName = getString(params, 'displayName') || ''
          const newDisplayName = displayName.startsWith(prefix) ? displayName : `${prefix}${displayName}`
          return { ...params, displayName: newDisplayName }
        },
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          // Strictly parse and narrow using Zod, achieving absolute cast-free typing!
          const safeParams: CreateDlpRuleParams = CreateDlpRuleSchema.parse(params)

          const {
            customerId,
            orgUnitId,
            displayName,
            description,
            triggers,
            condition,
            action,
            state,
            customMessage,
            watermarkMessage,
            blockScreenshot,
            saveContent,
            dataMasking,
          } = safeParams

          logger.debug(`${TAGS.MCP} Calling 'create_chrome_dlp_rule' with params: ${JSON.stringify(safeParams)}`)
          if (!cloudIdentityClient) {
            throw new Error('cloudIdentityClient is required for create_chrome_dlp_rule')
          }

          const fullTriggers = triggers.map(t => {
            const triggerObj = CHROME_TRIGGERS[t as keyof typeof CHROME_TRIGGERS]
            if (!triggerObj) {
              throw new Error(`Unknown trigger key: ${t}`)
            }
            return triggerObj.value
          })

          // Reject BLOCK actions in ACTIVE state to prevent accidental data loss
          const safetyValidation = validateMcpSafetyConstraints(action, state)
          if (!safetyValidation.isValid) {
            throw new Error(`MCP Safety Constraint Violation:\n- ${safetyValidation.errors.join('\n- ')}`)
          }

          const ruleConfig: Record<string, unknown> = {
            displayName,
            description,
            triggers: fullTriggers,
            state: state || POLICY_STATES.ACTIVE.value,
          }

          // Validate the CEL expression against the selected triggers
          if (condition) {
            const validationResult = validateCelCondition(condition, triggers)
            if (!validationResult.isValid) {
              throw new Error(`CEL condition validation failed:\n- ${validationResult.errors.join('\n- ')}`)
            }
            ruleConfig.condition = {
              contentCondition: condition,
            }
          }

          // Ensure action-parameter combinations are valid (e.g., watermarks require specific triggers)
          const actionValidation = validateActionParameters(
            action,
            {
              customMessage,
              watermarkMessage,
              blockScreenshot,
              dataMasking,
            },
            triggers,
          )
          if (!actionValidation.isValid) {
            throw new Error(actionValidation.errors.join('\n- '))
          }

          const actionData: Record<string, unknown> = {}
          if (customMessage) {
            actionData.customEndUserMessage = {
              unsafeHtmlMessageBody: customMessage,
            }
          }
          if (watermarkMessage) {
            actionData.watermarkMessage = watermarkMessage
          }
          if (blockScreenshot) {
            actionData.blockScreenshot = blockScreenshot
          }
          if (saveContent) {
            actionData.saveContent = saveContent
          }
          if (dataMasking) {
            const maskingData: Record<string, unknown> = {}
            if (dataMasking.regexDetectors) {
              maskingData.regexDetector = dataMasking.regexDetectors.map(m => ({
                maskType: m.maskType,
                resourceName: m.resourceName,
                displayName: m.displayName,
              }))
            }
            actionData.dataMasking = maskingData
          }

          const actionObj = CHROME_ACTION_TYPES[action]
          if (!actionObj) {
            throw new Error(`Unknown action: ${action}`)
          }
          const actionKey = actionObj.apiKey
          const chromeAction = {
            [actionKey]: Object.keys(actionData).length > 0 ? { actionParams: actionData } : {},
          }

          ruleConfig.action = {
            chromeAction,
          }

          const result = await cloudIdentityClient.createDlpRule(
            customerId || '',
            orgUnitId,
            ruleConfig,
            authToken || '',
          )
          const createdPolicy = result

          return safeFormatResponse({
            rawData: createdPolicy,
            toolName: 'create_chrome_dlp_rule',
            formatFn: (raw: unknown): McpToolResponse => {
              if (!isObject(raw)) {
                throw new Error('create_chrome_dlp_rule formatting failed: raw is not a valid object')
              }
              const setting = getObject(raw, 'setting')
              const settingValue = setting ? getObject(setting, 'value') : null
              const name = getString(raw, 'name') || ''
              const createdDisplayName =
                (settingValue && getString(settingValue, 'displayName')) ||
                getString(raw, 'displayName') ||
                name.split('/').pop() ||
                'Unnamed Rule'

              const auditNote =
                action === CHROME_ACTION_TYPES.AUDIT.value
                  ? '\n\nNote: AUDIT mode is silent and logs events without notifying or blocking the user.'
                  : ''
              return formatToolResponse({
                summary: `Successfully created Chrome DLP rule "${createdDisplayName}".\nResource name: \`${name}\`${auditNote}`,
                data: { dlpRule: raw },
                structuredContent: { dlpRule: raw },
              })
            },
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
