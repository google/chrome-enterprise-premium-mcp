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
  id: 'pr11',
  priority: 'P2',
  tags: ['prompt', 'rule-state'],
  scenario: 'overly-broad-block-rule',
  promptName: 'cep:optimize',
  expectedTools: ['diagnose_environment', 'get_chrome_activity_log'],
  goldenResponse:
    'Agent should report that multiple rules exist but one ("Block all sensitive content") has overly broad triggers (all 5 event types) and a match-all condition. The deployment has coverage but the rule quality needs work — the broad rule is a noise and false-positive risk that should be narrowed.',
  judgeInstructions:
    'The agent MUST identify the overly broad block rule and explain why its scope is a problem. Simply counting rules and saying everything looks good is FAIL. The agent should note that broad catch-all rules need refinement. If the agent uses internal taxonomy in the user-facing reply (e.g., "intermediate maturity", "Tier 2", "MECE"), grade as FAIL even if the rest of the analysis is correct.',
}
