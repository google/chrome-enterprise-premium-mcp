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
 * @file Prompt definition for the '/cep:optimize' command.
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * MCP prompt name for the environment optimization command.
 */
export const OPTIMIZE_PROMPT_NAME = 'cep:optimize'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const guidelinesPath = path.resolve(__dirname, '../../lib/knowledge/15-rule-quality-guidelines.md')

/**
 * Registers the '/cep:optimize' prompt with the MCP server.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export const registerOptimizePrompt = server => {
  server.registerPrompt(
    OPTIMIZE_PROMPT_NAME,
    {
      description: 'Perform a consultative analysis of DLP maturity, rule noise, and quality.',
      arguments: [],
    },
    async () => {
      const guidelinesContent = await fs.readFile(guidelinesPath, 'utf-8')
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Perform a consultative analysis of the Chrome Enterprise Premium environment's DLP maturity and rule quality.

Call the **diagnose_environment** tool to get a complete environment snapshot. Call the **get_chrome_activity_log** tool to analyze recent activity patterns and DLP events.

**Assessment Protocols:**
1. **Retrieve Maturity Framework**: Call **get_document** with **filename: 12** to retrieve the "CEP Security Posture & Remediation Guide". Use this to classify the environment into a Maturity Tier (0-3).
2. **Apply Quality Guidelines**: Use the following "Rule Optimization Framework" to identify logic flaws and noise:

${guidelinesContent}

**Required Output Format:**

### Maturity Assessment
Identify the current **Maturity Tier (0-3)** based on the environment baseline and current rule status.
- If in **Tier 0 (Foundation)**, list the specific missing prerequisites (Licenses, Connectors, or SEB extension).
- If in **Tier 1 (Visibility)**, you MUST analyze activity logs to identify real-world usage patterns before suggesting any new rules.
- If in **Tier 2 (Monitoring)**, prioritize tuning noisy audit-only rules.
- If in **Tier 3 (Protection)**, focus on maintaining enforcement and expanding coverage.

### Identified Rule Optimizations
For every rule that violates the assessment framework OR generates a disproportionately high volume of events in the activity logs, provide a structured breakdown:

#### Optimization [Number]: [Rule Name] (ID: [ID])
* **The Issue:** State the specific MECE dimension violation (e.g., Context Blindness, Threshold Sensitivity) or indicate "High Event Volume".
* **What I found:** Describe the specific finding in the rule logic or event history that triggered this diagnosis. Compare event volume per rule to identify noisy rules.
* **The Fix:** State the recommended tuning action in professional English.
* **The Patch:** Provide the optimized JSON or CEL block (if applicable).

### How I Can Help You Next
List the specific actions you can take to improve the environment, such as:
* **Update Rules:** Offer to deploy the specific patches listed above.
* **Change Enforcement:** Offer to transition specific rules from AUDIT to WARN.
* **Clean Up:** Offer to delete specific inactive or orphaned rules.

**Tone and Voice Guardrails:**
- Use active voice with human subjects.
- Be direct. State the point, support it, and move on.
- Avoid rhetorical flourishes, dramatic one-liners, and throat-clearing transitions.
- Use headers for structure and bullets for parallel items.
- NEVER mention internal tool names (e.g., diagnose_environment) in your final response.`,
            },
          },
        ],
      }
    },
  )
}
