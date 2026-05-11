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
      description: "Review the environment's DLP rules and recommend specific tuning, enforcement, or cleanup actions.",
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
              text: `Review the Chrome Enterprise Premium environment's DLP rules and recommend concrete tuning, enforcement, or cleanup actions.

Call **diagnose_environment** to snapshot the current state. Call **get_chrome_activity_log** to surface recent DLP event volume per rule.

Call **get_document** with **filename: 12** to load the internal posture-assessment criteria. Apply the rule-evaluation heuristics below to identify logic flaws and noise:

${guidelinesContent}

These heuristics and posture criteria are internal evaluation aids. Do not name them, group them, or quote their wrappers in your reply. Translate every finding into plain administrator-facing language.

**Required Output Format (the order of these sections is mandatory):**

### Environment summary

A concise paragraph describing what's in place (licenses, connectors, SEB extension, rule count, audit-vs-enforcement balance) and what's missing. Lead with the most consequential gap. Do not use tier labels, framework names, or model numbers.

### What the logs show

Lead this section with what the activity log told you, before any rule-config analysis. Cover:
* Total DLP events in the window the log returned (and how recent the most recent event was).
* Per-rule event volume — which rules are firing the most, which are firing once or twice, which are not firing at all. Include a bullet list with the rule name and the count.
* Cross-rule patterns — single users hitting many rules, single rules hitting many users, time-of-day spikes, audit-vs-enforcement skew, or whatever else stands out.
* The headline read of the volume: is one rule generating most of the noise, is the volume spread evenly across rules, or is the volume low across the board (in which case there is no high-noise rule and that itself is the finding).

If the activity log is empty or near-empty, state that plainly here. Do not skip this section just because volume is low — the absence of events is itself a useful observation, especially when rules exist.

### Rule findings

For each rule that needs attention — anchored in what the logs above showed, then layered with rule-quality heuristics:

#### [Rule name] (ID: [policy id])
* **What the logs show for this rule:** Event count from the section above and any pattern specific to this rule (single user, particular trigger, spike, etc.). If the rule has zero events, say so.
* **What we found in the rule logic:** Describe the heuristic-based issue in the rule's configuration. Skip this bullet only when the rule's logic is fine and the issue is purely volume.
* **Why it matters:** One sentence on the user impact (false positives, blind spots, helpdesk friction, dead-letter rules).
* **Recommended change:** Plain-language action.
* **Patch:** Optimized JSON or CEL block when applicable.

If no rule needs attention because volume is low and configurations are reasonable, write a single sentence saying so. Do not invent issues to fill the section.

### Suggested next actions

Offer specific follow-ups the agent can execute on request, such as:
* Deploying the patches listed above.
* Transitioning specific rules from AUDIT to WARN.
* Deleting specific inactive or orphaned rules.
* Continuing to monitor when volume is low and rules are reasonable.

**Tone and voice:**
- Active voice, human subjects.
- Direct: state the point, support it, move on.
- Headers for structure, bullets for parallel items.
- Never mention internal tool names, framework names, tier numbers, or evaluation-criteria labels in your reply.`,
            },
          },
        ],
      }
    },
  )
}
