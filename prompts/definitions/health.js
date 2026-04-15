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
 * @file Prompt definition for the '/cep:health' command.
 */

import { SHARED_DIAGNOSTIC_RULES } from './shared.js'

/**
 * MCP prompt name for the environment health-check command.
 */
export const HEALTH_PROMPT_NAME = 'cep:health'

/**
 * Registers the '/cep:health' prompt with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerHealthPrompt = server => {
  server.registerPrompt(
    HEALTH_PROMPT_NAME,
    {
      description: "Run a health check on the user's environment.",
      arguments: [],
    },
    async () => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Run a health check on the Chrome Enterprise Premium environment.

Call the **diagnose_environment** tool to get a complete environment snapshot in one call. It checks:

- **Subscription**: Whether an active CEP license exists and how many are assigned
- **Organizational Units**: The OU hierarchy
- **DLP Rules**: How many rules exist, whether they are active, and what enforcement actions (block/warn/audit) are configured
- **Content Detectors**: Custom regex, word list, and URL list detectors
- **Connectors (root OU)**: Whether each content analysis connector is configured — file upload, file download, paste/bulk text, print, real-time URL check, and security event reporting
- **SEB Extension**: Whether the Secure Enterprise Browser extension is force-installed on the root OU
- **Browser Versions**: Distribution of Chrome versions across managed devices

The response includes a pre-computed **issues[]** array with severity ratings. Use this as your starting point, but also examine the raw data to provide context. For example:
- If a connector is missing, explain what content goes unscanned without it
- If DLP rules are audit-only, explain that users are not blocked or warned
- If the SEB extension is missing, explain which features (like data masking) depend on it
- If there are no issues, confirm the environment is healthy and summarize the key metrics

${SHARED_DIAGNOSTIC_RULES}
`,
            },
          },
        ],
      }
    },
  )
}
