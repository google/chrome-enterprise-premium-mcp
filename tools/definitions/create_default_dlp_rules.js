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
 * @fileoverview Tool definition for creating the default Chrome DLP rules as a starting pack.
 */

import { z } from 'zod'
import { guardedToolCall, formatToolResponse, safeFormatResponse } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { CHROME_TRIGGERS, POLICY_STATES } from '../../lib/util/chrome_dlp_constants.js'

const DEFAULT_RULES = {
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

/**
 * Registers the 'create_default_dlp_rules' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} options.cloudIdentityClient - The Cloud Identity client instance.
 * @param {object} sessionState - The session state object for caching.
 */
export function registerCreateDefaultDlpRulesTool(server, options, sessionState) {
  const { cloudIdentityClient } = options
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
        customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
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
        handler: async (params, { authToken }) => {
          logger.debug(`${TAGS.MCP} Calling 'create_default_dlp_rules' with params: ${JSON.stringify(params)}`)
          const { customerId, orgUnitId } = params

          const ruleResults = []
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
              const result = await cloudIdentityClient.createDlpRule(customerId, orgUnitId, ruleConfig, authToken)
              const createdPolicy = result.response
              ruleResults.push({
                displayName: rule.displayName,
                status: 'Created',
                name: createdPolicy.name,
                success: true,
              })
            } catch (error) {
              let errorMsg = error.message
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
            formatFn: raw => {
              const createdRules = raw.ruleResults
                .filter(r => r.success)
                .map(r => ({ displayName: r.displayName, name: r.name }))
              const failedRules = raw.ruleResults
                .filter(r => !r.success)
                .map(r => ({ displayName: r.displayName, error: r.error }))
              const successCount = createdRules.length
              const failureCount = failedRules.length

              const summary = [
                `## Default DLP Rules Created (${successCount} of ${raw.ruleResults.length} succeeded)`,
                '',
                ...raw.ruleResults.map(r => {
                  const detail = r.success ? `, resource: \`${r.name}\`` : ` (${r.error})`
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
