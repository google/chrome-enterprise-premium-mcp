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
 * @file Prompt definition for the 'cep:expert' command.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * MCP prompt name for the Chrome Enterprise Premium expert context command.
 */
export const EXPERT_PROMPT_NAME = 'cep:expert'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const systemPromptPath = path.resolve(__dirname, '../system-prompt.md')

/**
 * Registers the 'cep:expert' prompt with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerExpertPrompt = server => {
  server.registerPrompt(
    EXPERT_PROMPT_NAME,
    {
      description: 'Re-inject the Chrome Enterprise Premium expert context.',
      arguments: [],
    },
    async () => {
      const promptContent = fs.readFileSync(systemPromptPath, 'utf-8')
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: promptContent,
            },
          },
        ],
      }
    },
  )
}
