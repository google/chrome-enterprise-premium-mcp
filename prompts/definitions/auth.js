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
 * @file Prompt definition for the '/cep:auth' command.
 *
 * Intentionally thin — the prompt just points the agent at the `cep_auth`
 * tool, which does all the work.
 */

/**
 * MCP prompt name for the sign-in command.
 */
export const AUTH_PROMPT_NAME = 'cep:auth'

/**
 * Registers the '/cep:auth' prompt with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerAuthPrompt = server => {
  server.registerPrompt(
    AUTH_PROMPT_NAME,
    {
      description: 'Sign in to the Chrome Enterprise Premium MCP server.',
      arguments: [],
    },
    async () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `The user wants to sign in. Call the **cep_auth** tool with no arguments to start.

- If the tool returns status="completed", the access token is cached and you're done.
- If the tool returns status="awaiting" with nextAction="paste-redirect-url", show the user the authUrl from the response, ask them to open it in a browser and complete sign-in, then ask them to paste the full URL the browser is redirected to (it looks like \`http://127.0.0.1:PORT/?code=...&state=...\` and the page may show "connection refused" — that's expected). Call **cep_auth** again with that pasted URL as the redirectUrl argument.
- If the tool returns status="error", relay the message to the user.`,
          },
        },
      ],
    }),
  )
}
