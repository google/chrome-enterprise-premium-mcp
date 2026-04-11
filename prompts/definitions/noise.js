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
 * @file Prompt definition for the '/cep:noise' command.
 */

export const NOISE_PROMPT_NAME = 'cep:noise'

/**
 * Registers the '/cep:noise' prompt with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerNoisePrompt = server => {
  server.registerPrompt(
    NOISE_PROMPT_NAME,
    {
      description: "Analyze the user's DLP rule noise.",
      arguments: [],
    },
    async () => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze DLP rule noise in the Chrome Enterprise Premium environment.

Call **diagnose_environment** to get DLP rules and the environment snapshot. Then call **get_chrome_activity_log** to see recent DLP events.

Compare event volume per rule to identify noisy rules. Look for:
- Rules generating disproportionately many events
- Overly broad conditions (e.g., matching all content types across all triggers)
- Rules where most events are from a small number of users or destinations

Report per-rule event counts, flag noisy rules, and recommend optimizations (narrower conditions, URL allowlists, switching from block to warn).`,
            },
          },
        ],
      }
    },
  )
}
