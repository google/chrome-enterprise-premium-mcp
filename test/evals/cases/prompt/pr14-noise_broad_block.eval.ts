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
  id: 'pr14',
  priority: 'P2',
  tags: ['prompt', 'noise'],
  scenario: 'overly-broad-block-rule',
  promptName: 'cep:optimize',
  expectedTools: ['diagnose_environment', 'get_chrome_activity_log'],
  goldenResponse:
    'Agent should analyze DLP rules and activity logs. The "Block all sensitive content" rule matches all content across all 5 trigger types, which is a recipe for high noise and user friction. Even if current event volume is low, the agent should flag this rule\'s configuration as a noise risk due to its overly broad conditions and recommend narrowing triggers and tightening the content condition.',
  judgeInstructions:
    'The agent MUST identify the overly broad block rule as a potential noise source based on its configuration (all triggers, match-all condition), even if current event counts are modest. Simply reporting event counts without analyzing rule configuration quality is insufficient. Recommending specific narrowing actions counts as a strong PASS.',
}
