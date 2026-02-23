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
 * @fileoverview Prompt definition for the '/cep:noise' command.
 */

export const NOISE_PROMPT_NAME = 'cep:noise'

/**
 * Registers the '/cep:noise' prompt with the MCP server.
 *
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
              text: `You are a Chrome Enterprise security expert. To analyze the Data Loss Prevention (DLP) rule noise, follow these steps:

1. List the DLP rules.
2. Get the DLP events.
3. Identify DLP rules with high false positive rates or override rates.
4. Recommend optimization actions to reduce rule noise.`,
            },
          },
        ],
      }
    },
  )
}
