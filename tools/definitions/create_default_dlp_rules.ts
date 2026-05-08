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
 * @file Tool definition for creating the default Chrome DLP rules as a starting pack.
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
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { CHROME_TRIGGERS, POLICY_STATES } from '../../lib/util/chrome_dlp_constants.js'
import { isObject, isApiError } from '../../lib/util/helpers.js'

const DEFAULT_RULES: Record<
  string,
  {
    displayName: string
    description: string
    triggers: string[]
    condition: string
    action: Record<string, unknown>
  }
> = {
  AUDIT_GEN_AI_VISITS: {
    displayName: '🤖 Audit visits to generative AI sites',
    description:
      'Monitor when users visit generative AI sites to gain insights into how AI is used in your organization',
    triggers: [CHROME_TRIGGERS.URL_NAVIGATION.value],
    condition: "url_category.matches_web_category('INTERNET_AND_TECHNOLOGY__GENERATIVE_AI')",
    action: {
      chromeAction: {
        auditOnly: {},
      },
    },
  },
  WATERMARK_SENSITIVE_SITES: {
    displayName: '🤖 Watermark sensitive sites (Gmail, Salesforce, Zendesk)',
    description:
      'Apply a visible watermark when users visit Gmail, Salesforce, or Zendesk to protect against unauthorized data sharing.',
    triggers: [CHROME_TRIGGERS.URL_NAVIGATION.value],
    condition: "url.contains('gmail.com') || url.contains('salesforce.com') || url.contains('zendesk.com')",
    action: {
      chromeAction: {
        auditOnly: {
          actionParams: {
            watermarkMessage: 'This site may contain sensitive data. Handle with care.',
          },
        },
      },
    },
  },
  WARN_PASTE_GEN_AI: {
    displayName: '🤖 Warn before pasting on generative AI sites (Gemini allowed)',
    description:
      'Warn users before pasting content on generative AI sites (except gemini.google.com) to prevent sensitive data from being shared with AI models.',
    triggers: [CHROME_TRIGGERS.WEB_CONTENT_UPLOAD.value],
    condition:
      "url_category.matches_web_category('INTERNET_AND_TECHNOLOGY__GENERATIVE_AI') && !url.contains('gemini.google.com')",
    action: {
      chromeAction: {
        warnUser: {
          actionParams: {
            customEndUserMessage: {
              unsafeHtmlMessageBody:
                'Warning: You are pasting content into a Generative AI site. Please ensure no sensitive corporate data or personally identifiable information (PII) is included. Use Gemini (gemini.google.com) for approved AI tasks.',
            },
          },
        },
      },
    },
  },
}

const CreateDefaultDlpRulesSchema = z.object({
  customerId: z.string().optional(),
  orgUnitId: z.string(),
})

type CreateDefaultDlpRulesParams = z.infer<typeof CreateDefaultDlpRulesSchema>

interface RuleResult {
  displayName: string
  status: string
  name?: string
  error?: string
  success: boolean
}

interface DefaultRulesResult {
  ruleResults: RuleResult[]
  orgUnitId: string
}

function isDefaultRulesResult(raw: unknown): raw is DefaultRulesResult {
  if (!isObject(raw)) {
    return false
  }
  if (typeof raw.orgUnitId !== 'string') {
    return false
  }
  if (!Array.isArray(raw.ruleResults)) {
    return false
  }
  return true
}

/**
 * Registers the 'create_default_dlp_rules' tool with the MCP server.
 * @param server The MCP server instance.
 * @param options Configuration options for the tool.
 * @param sessionState The session state object for caching.
 */
export function registerCreateDefaultDlpRulesTool(
  server: McpServer,
  options: GuardedToolOptions,
  sessionState: SessionState,
): void {
  const { apiClients } = options
  const cloudIdentityClient = apiClients?.cloudIdentity
  logger.debug(`${TAGS.MCP} Registering 'create_default_dlp_rules' tool...`)

  server.registerTool(
    'create_default_dlp_rules',
    {
      description: `Creates a "Starter Pack" of default Chrome DLP rules for a specific Organizational Unit.
Rules included:
1. Audit visits to Generative AI sites.
2. Apply watermarks to sensitive sites (Gmail, Salesforce, Zendesk).
3. Warn users before pasting content on Generative AI sites (Gemini is excluded from warning).`,
      inputSchema: {
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345).'),
        orgUnitId: z.string().describe('The target Organizational Unit ID'),
      },
      outputSchema: z
        .object({
          createdRules: z.array(z.object({ displayName: z.string(), name: z.string() }).passthrough()),
          failedRules: z.array(z.object({ displayName: z.string(), error: z.string() }).passthrough()),
          successCount: z.number(),
          failureCount: z.number(),
        })
        .passthrough(),
    },

    guardedToolCall(
      {
        handler: async (params: Record<string, unknown>, { authToken }): Promise<McpToolResponse> => {
          logger.debug(`${TAGS.MCP} Calling 'create_default_dlp_rules' with params: ${JSON.stringify(params)}`)
          if (!cloudIdentityClient) {
            throw new Error('cloudIdentityClient is required for create_default_dlp_rules')
          }

          // Strictly parse using Zod
          const safeParams: CreateDefaultDlpRulesParams = CreateDefaultDlpRulesSchema.parse(params)
          const { customerId, orgUnitId } = safeParams

          const ruleResults: RuleResult[] = []
          for (const ruleKey of Object.keys(DEFAULT_RULES)) {
            const rule = DEFAULT_RULES[ruleKey]
            const ruleConfig = {
              displayName: rule.displayName,
              description: rule.description,
              triggers: rule.triggers,
              state: POLICY_STATES.ACTIVE.value,
              condition: {
                contentCondition: rule.condition,
              },
              action: rule.action,
            }

            try {
              const result = await cloudIdentityClient.createDlpRule(
                customerId || '',
                orgUnitId,
                ruleConfig,
                authToken || '',
              )
              const createdPolicy = result // result is the policy directly!
              ruleResults.push({
                displayName: rule.displayName,
                status: 'Created',
                name: createdPolicy.name || '',
                success: true,
              })
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message || '' : String(error)
              const status =
                isObject(error) && typeof error['status'] === 'number'
                  ? error['status']
                  : isApiError(error)
                    ? error.response?.status
                    : undefined

              const isAuthError =
                status === 401 ||
                status === 403 ||
                errorMessage.includes('UNAUTHENTICATED') ||
                errorMessage.includes('PERMISSION_DENIED') ||
                errorMessage.includes('invalid_grant')

              if (isAuthError) {
                throw error
              }

              let errorMsg = ''
              if (error instanceof Error) {
                errorMsg = error.message
              } else {
                errorMsg = String(error)
              }
              if (
                errorMsg.includes('already exists') ||
                errorMsg.includes('409') ||
                errorMsg.includes('ALREADY_EXISTS')
              ) {
                errorMsg = 'Already exists'
              }
              logger.error(`${TAGS.MCP} Failed to create rule ${ruleKey}:`, error)
              ruleResults.push({
                displayName: rule.displayName,
                status: errorMsg === 'Already exists' ? 'Skipped' : 'Failed',
                error: errorMsg,
                success: false,
              })
            }
          }

          return safeFormatResponse({
            rawData: { ruleResults, orgUnitId },
            toolName: 'create_default_dlp_rules',
            formatFn: (raw: unknown): McpToolResponse => {
              if (!isDefaultRulesResult(raw)) {
                throw new Error('create_default_dlp_rules formatting failed: rawData is invalid')
              }
              const createdRules = raw.ruleResults
                .filter(r => r.success)
                .map(r => ({ displayName: r.displayName, name: r.name || '' }))
              const failedRules = raw.ruleResults
                .filter(r => !r.success)
                .map(r => ({ displayName: r.displayName, error: r.error || '' }))
              const successCount = createdRules.length
              const failureCount = failedRules.length

              const summary = [
                `## Default DLP Rules Created (${successCount} of ${raw.ruleResults.length} succeeded)`,
                '',
                ...raw.ruleResults.map(r => {
                  const detail = r.success ? `, resource: \`${r.name || ''}\`` : ` (${r.error || ''})`
                  return `- **${r.displayName}** — ${r.status.toLowerCase()}${detail}`
                }),
                '',
                'Note: Rules in AUDIT mode (like visits to generative AI sites) are silent and log events without notifying or blocking the user.',
              ].join('\n')

              const sc = { createdRules, failedRules, successCount, failureCount }

              const response = formatToolResponse({
                summary,
                data: sc,
                structuredContent: sc,
              })

              if (failureCount > 0) {
                response.isError = true
              }

              return response
            },
          })
        },
      },
      options,
      sessionState,
    ),
  )
}
