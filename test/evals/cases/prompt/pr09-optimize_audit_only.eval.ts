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
  id: 'pr09',
  priority: 'P2',
  tags: ['prompt', 'rule-state'],
  scenario: 'audit-only-rules',
  promptName: 'cep:optimize',
  expectedTools: ['diagnose_environment', 'get_chrome_activity_log'],
  goldenResponse:
    'Agent should report that all 4 DLP rules are in audit-only mode — the environment is logging events but not enforcing. Agent should recommend progressing high-confidence rules from audit to warn so the policies start having user-visible effect.',
  judgeInstructions:
    'The agent MUST identify that all rules are audit-only and recommend progression to warn or block for high-confidence rules. If the agent says rules are already enforcing, grade as FAIL. If the agent uses internal taxonomy in the user-facing reply (e.g., "Tier 1", "early monitoring stage", "maturity model", "MECE"), grade as FAIL even if the rest of the analysis is correct.',
}
