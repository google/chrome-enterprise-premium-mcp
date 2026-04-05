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
 * @fileoverview Prompt definition for the '/cep:feedback' command.
 */

export const FEEDBACK_PROMPT_NAME = 'cep:feedback'

/**
 * Registers the '/cep:feedback' prompt with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerFeedbackPrompt = server => {
  server.registerPrompt(
    FEEDBACK_PROMPT_NAME,
    {
      description: "Generates a diagnostic feedback report using the 'cep_feedback' tool.",
      arguments: [
        {
          name: 'userMessage',
          description: 'A detailed description of what went wrong or what you were trying to achieve.',
          required: false,
        },
      ],
    },
    async args => {
      const userMessage =
        args.userMessage || 'The user requested a diagnostic feedback report without specifying details.'
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please generate a diagnostic feedback report for this session by calling the 'cep_feedback' tool.
The user provided the following context: "${userMessage}"`,
            },
          },
        ],
      }
    },
  )
}
