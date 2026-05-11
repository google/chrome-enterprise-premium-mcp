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

export default {
  id: 'pr08',
  priority: 'P2',
  tags: ['prompt', 'rule-state'],
  scenario: 'no-dlp-rules',
  promptName: 'cep:optimize',
  expectedTools: ['diagnose_environment', 'get_chrome_activity_log'],
  goldenResponse:
    'Agent should report that the environment has no DLP rules in place and that no enforcement is active. Agent should recommend starting with audit-mode rules to gain visibility before turning on warn or block actions.',
  judgeInstructions:
    'The agent MUST identify that there are no DLP rules and explain that the environment has no DLP coverage. If the agent reports any existing DLP rules, grade as FAIL (the scenario removes them all). Recommending a phased rollout (audit first, then warn, then block) shows strong understanding. If the agent labels this state with internal taxonomy in the user-facing reply (e.g., "Tier 0", "early stage", "low maturity", "MECE", "Maturity Model"), grade as FAIL even if the rest of the analysis is correct.',
}
