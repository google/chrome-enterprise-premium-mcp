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
  id: 'pr10',
  priority: 'P2',
  tags: ['prompt', 'rule-state'],
  scenario: 'healthy',
  promptName: 'cep:optimize',
  expectedTools: ['diagnose_environment', 'get_chrome_activity_log'],
  goldenResponse:
    'Agent should report 4 active DLP rules across multiple OUs covering a mix of block, watermark, audit, and warn actions, with activity logs showing events being generated. Agent may recommend further refinements but should acknowledge that the deployment is solid.',
  judgeInstructions:
    'The agent MUST identify that multiple rules with different action types are active and producing events. If the agent says there are no rules or that nothing is enforcing, grade as FAIL. If the agent uses internal taxonomy in the user-facing reply (e.g., "Tier 3", "advanced maturity", "MECE"), grade as FAIL even if the rest of the analysis is correct. Plain descriptions like "rules in mixed enforcement modes are firing" are the expected style.',
}
