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
 * @fileoverview Prompt definition for the '/cep:maturity' command.
 */

export const MATURITY_PROMPT_NAME = 'cep:maturity'

/**
 * Registers the '/cep:maturity' prompt with the MCP server.
 *
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
              text: `You are a Chrome Enterprise security expert. To assess the Data Loss Prevention (DLP) maturity, follow these steps:

1. List the organizational units.
2. List the DLP rules.
3. Get the DLP events.
4. Analyze the DLP rule configuration and telemetry to determine the maturity stage.
5. Recommend next steps to improve the DLP maturity.`,
            },
          },
        ],
      }
    },
  )
}
