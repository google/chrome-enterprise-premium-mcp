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
 * @fileoverview Prompt definition for the main '/cep' command.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../../lib/util/logger.js'
import { SHARED_DIAGNOSTIC_RULES } from './shared.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const CEP_PROMPT_NAME = 'cep'

/**
 * Registers the main '/cep' prompt with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerCepPrompt = server => {
  server.registerPrompt(
    CEP_PROMPT_NAME,
    {
      description:
        'Chrome Enterprise Premium diagnostics and analysis tool. Initializes the agent with full expert instructions.',
      arguments: [],
    },
    async () => {
      let systemPrompt = 'You are a specialized Chrome Enterprise Premium (CEP) security expert AI agent.'
      try {
        const promptPath = path.resolve(__dirname, '../system-prompt.md')
        logger.info(`[MCP PROMPT] Attempting to load system prompt from: ${promptPath}`)
        systemPrompt = fs.readFileSync(promptPath, 'utf-8')

        const capabilitiesPath = path.resolve(__dirname, '../../lib/knowledge/0-agent-capabilities.md')
        if (fs.existsSync(capabilitiesPath)) {
          const capabilitiesContent = fs.readFileSync(capabilitiesPath, 'utf-8')
          systemPrompt = systemPrompt.replace('{{CAPABILITIES_DOC}}', capabilitiesContent)
        }
      } catch (err) {
        logger.error(
          `[MCP PROMPT] CRITICAL: Could not load system prompt from ${path.resolve(__dirname, '../system-prompt.md')}:`,
          err,
        )
      }

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: systemPrompt,
            },
          },
          {
            role: 'user',
            content: {
              type: 'text',
              text: `To run a health check on the user's environment, follow these steps:

1. List the organizational units.
2. For each organizational unit, verify these settings:
    *   Is Chrome Browser Cloud Management (CBCM) enrollment active?
    *   Do browsers report to the admin console?
    *   Is the Chrome browser version current?
    *   Is an active Chrome Enterprise Premium license assigned?
    *   Are security connectors set to **Chrome Enterprise Premium**?
    *   Is **Delay file upload** configured for enforcement?
    *   Is **Enhanced Safe Browsing** enabled?
    *   Are Data Loss Prevention (DLP) rules enabled?
    *   Is reporting enabled for DLP events?
${SHARED_DIAGNOSTIC_RULES}

(Note: Other available commands include "/cep:maturity" and "/cep:noise".)`,
            },
          },
        ],
      }
    },
  )
}
