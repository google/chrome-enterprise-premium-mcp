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
  id: 'pr13',
  priority: 'P2',
  tags: ['prompt', 'noise'],
  scenario: 'high-noise-rule',
  promptName: 'cep:optimize',
  expectedTools: ['diagnose_environment', 'get_chrome_activity_log'],
  goldenResponse:
    'Agent should identify that the "Audit pastes to generative AI sites" rule is generating significantly more events than other rules (24 events vs 1 from the block rule). Multiple users across multiple days are triggering it. Agent should flag this as a high-noise rule and recommend either tightening the rule\'s conditions, switching to a more targeted URL list, or accepting the volume if monitoring GenAI usage is a priority.',
  judgeInstructions:
    'The agent MUST identify the audit rule as the highest-noise rule by analyzing the event log. If the agent reports all rules as equally noisy or fails to correlate events to specific rules, grade as FAIL. Exact numerical event counts are not strictly required as long as the rule is correctly identified as the primary source of noise. Concrete recommendations for reducing noise (narrowing conditions, refining URL matching, or accepting noise with justification) are required for PASS.',
}
