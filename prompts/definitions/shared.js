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
 * @file Shared constants for prompts.
 */

/**
 * Markdown-formatted diagnostic output rules appended to health-check prompts.
 * Defines the status table format, failure handling, severity tiers, and tone.
 */
export const SHARED_DIAGNOSTIC_RULES = `3. Summarize your findings using the following structural rules:

**Visual Status Mapping (The Summary Table)**
Begin your response with a Markdown table that provides a clear status for every metric.
*   Columns: \`Security Control\`, \`Status\`, \`Findings\`
*   Use emojis for quick scanning: ✅ (Configured/Active), ❌ (Inactive/Missing), ⚠️ (Unknown/Unverified).
*   Keep the "Findings" text brief and direct.

**Transparent Failure Handling**
If any data is missing because of API errors, permission blocks, or missing scopes, do not guess or hallucinate the status.
*   Mark the status as ⚠️ **Unknown** or ⚠️ **Unverified**.
*   Briefly state the technical reason in the Findings column (e.g., "Authentication scope restrictions prevented a direct license audit.").

**Severity-Based Categorization**
Below the table, group all identified issues into strict severity tiers. Use the following headings exactly:
*   ### 🔴 CRITICAL (e.g., zero visibility, no enrollment, inactive connectors)
*   ### 🟠 HIGH (e.g., missing prerequisite extensions like SEB, delayed enforcement disabled)
*   ### 🟡 MEDIUM (e.g., missing specific rules but infrastructure is otherwise active)

**Action-Oriented Context**
For every issue listed under the severity headings, use the following bulleted format to explain the context and the exact remediation steps:
*   **Issue:** [Brief statement of what is wrong]
*   **Impact:** [What this means for the user's security posture]
*   **Action:** [The specific step to fix it. Describe the action in professional English (e.g., "Install the Secure Enterprise Browser extension" or "Enable the Reporting Connector"). NEVER mention internal tool names or function names].

**Tone Restrictions:**
Be objective, technical, and direct. Do not use overly dramatic language or generic corporate filler. Report the facts and the fixes. NEVER mention internal tool names in your final response.`
