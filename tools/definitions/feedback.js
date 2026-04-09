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
 * @fileoverview Tool definition for gathering diagnostic feedback.
 */

import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { guardedToolCall } from '../utils/wrapper.js'
import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Registers the 'cep_feedback' tool with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance.
 * @param {object} options - Configuration options for the tool.
 * @param {object} sessionState - The session state object for gathering data.
 */
export function registerFeedbackTool(server, options, sessionState) {
  logger.debug(`${TAGS.MCP} Registering 'cep_feedback' tool...`)

  server.registerTool(
    'cep_feedback',
    {
      description: `Gathers diagnostic data from the current session and creates a detailed feedback report. 
        Use this when the agent is failing, providing incorrect information, or if you encounter technical errors.
        It collects tool call history, session state (Customer/OU IDs), and user-provided context.`,
      inputSchema: z.object({
        userMessage: z
          .string()
          .describe('A detailed description of what went wrong or what you were trying to achieve.'),
        transcripts: z.string().optional().describe('Optional: The last few messages of the conversation for context.'),
      }),
    },
    guardedToolCall(
      {
        handler: async ({ userMessage, transcripts }) => {
          logger.info(`${TAGS.MCP} Generating diagnostic feedback report...`)

          const now = new Date()
          const timestampStr = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0]
          const filename = `cep_feedback_${timestampStr}.md`
          const filePath = path.resolve(process.cwd(), filename)

          let report = `# CEP Agent Diagnostic Feedback Report\n\n`
          report += `**Generated:** ${now.toLocaleString()}\n`
          report += `**User Reported Issue:** ${userMessage}\n\n`

          if (transcripts) {
            report += `## Conversation Transcripts\n\`\`\`text\n${transcripts}\n\`\`\`\n\n`
          }

          report += `## Session Knowledge\n`
          report += `*   **Customer ID:** \`${sessionState.customerId || 'Unknown'}\`\n`
          report += `*   **Cached Root OU ID:** \`${sessionState.cachedRootOrgUnitId || 'None'}\`\n`
          report += `*   **Pending Rule State:** \`${sessionState.pendingRule ? 'Yes' : 'No'}\`\n\n`

          report += `## Tool Call History (${sessionState.history?.length || 0} events)\n`
          if (sessionState.history && sessionState.history.length > 0) {
            sessionState.history.forEach((event, idx) => {
              report += `### ${idx + 1}. ${event.tool} @ ${new Date(event.timestamp).toLocaleTimeString()}\n`
              report += `**Params:** \`${JSON.stringify(event.params)}\`\n`
              if (event.error) {
                report += `**Error:** ❌ \`${event.error}\`\n`
              } else {
                report += `**Result Status:** ✅ Success\n`
                // Snippet of result text if it's too large
                const resText = event.result?.content?.[0]?.text || 'No text output'
                const snippet = resText.length > 500 ? resText.substring(0, 500) + '...' : resText
                report += `**Output Snippet:**\n\`\`\`text\n${snippet}\n\`\`\`\n`
              }
              report += `\n---\n`
            })
          } else {
            report += `*No tool calls recorded in this session history.*\n`
          }

          report += `\n## Environment Metadata\n`
          report += `*   **Platform:** \`${process.platform}\`\n`
          report += `*   **Node Version:** \`${process.version}\`\n`
          report += `*   **CWD:** \`${process.cwd()}\`\n`

          try {
            fs.writeFileSync(filePath, report, 'utf8')
            const successMsg = `✅ Diagnostic feedback report successfully created at: \`${filePath}\`\n\nPlease share this file with the development team for troubleshooting.`

            return {
              content: [
                {
                  type: 'text',
                  text: successMsg,
                },
              ],
              structuredContent: {
                reportPath: filePath,
                reportName: filename,
                eventCount: sessionState.history?.length || 0,
              },
            }
          } catch (e) {
            logger.error(`${TAGS.MCP} Failed to write feedback report:`, e)
            throw new Error(`Failed to save feedback report: ${e.message}`)
          }
        },
        skipAutoResolve: true,
      },
      options,
      sessionState,
    ),
  )
}
