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

The response includes a pre-computed **issues[]** array with severity ratings. Use this as your starting point, but also examine the raw data to identify **dependencies between controls** before reporting. The most useful health check leads with the upstream gap, not a list of leaf failures. Look for:
- **Connectors and DLP rules.** DLP rules cannot scan content unless the matching Content Analysis Connector is enabled. If connectors are missing while DLP rules exist, the rules are inert — surface this as the top finding rather than listing the connector gaps and the rule list separately.
- **Detectors and DLP rules.** Active DLP rules can reference custom detectors. If a referenced detector doesn't exist, the rule silently produces no matches. Flag this dependency explicitly.
- **Subscription and everything else.** If the CEP subscription is inactive or has zero licenses assigned, no other control matters until that's fixed.
- **SEB extension and browser-side features.** Data masking and other in-browser enforcement only work where the Secure Enterprise Browser extension is force-installed.
- **Audit-only rules.** Rules in audit mode don't block or warn users; they only log events. Note this when summarizing rule status.
- **Healthy environment.** When nothing is broken, confirm the environment is healthy and summarize the key metrics — don't manufacture a problem.

${SHARED_DIAGNOSTIC_RULES}
`,
            },
          },
        ],
      }
    },
  )
}
