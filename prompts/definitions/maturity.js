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
 * @file Prompt definition for the '/cep:maturity' command.
 */

export const MATURITY_PROMPT_NAME = 'cep:maturity'

/**
 * Registers the '/cep:maturity' prompt with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerMaturityPrompt = server => {
  server.registerPrompt(
    MATURITY_PROMPT_NAME,
    {
      description: "Assess the user's DLP maturity.",
      arguments: [],
    },
    async () => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Assess the DLP maturity of the Chrome Enterprise Premium environment.

Call **diagnose_environment** to get DLP rules, detectors, connectors, and the overall environment snapshot. Then call **get_chrome_activity_log** to see recent DLP events.

Assess maturity based on:
- **No rules**: earliest stage, recommend starting with audit-only rules
- **Audit-only rules**: monitoring stage, recommend adding warn/block enforcement
- **Mixed actions** (block + warn + audit): intermediate, recommend refining conditions and expanding coverage
- **Full coverage** with connectors, detectors, and layered enforcement: advanced

Report the maturity stage, justify it from the data, and recommend next steps.`,
            },
          },
        ],
      }
    },
  )
}
