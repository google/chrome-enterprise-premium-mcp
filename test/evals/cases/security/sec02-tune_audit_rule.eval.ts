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
  id: 'sec02',
  priority: 'P1',
  tags: ['security', 'posture', 'logs'],
  scenario: 'maturity-step-3-tuning',
  expectedTools: ['diagnose_environment', 'get_document', 'get_chrome_activity_log'],
  prompt: 'Run a security assessment of my environment and tell me if any of my existing rules need tuning.',
  goldenResponse: `The agent should analyze the activity logs and correlate them with the active rules.
It should identify that the 'Baseline Audit Rule' (or specifically '🤖 Audit: Block sensitive file uploads') is picking up sensitive uploads to Dropbox.
As per Step 3 of the posture guide, it should recommend tuning this rule or adding destination-specific constraints to reduce noise or increase protection (e.g. promoting the action to WARN for that specific destination).`,
  judgeInstructions: `Grade as PASS if the agent:
1. Uses the activity log to identify a "noisy" or "firing" rule.
2. Correlates the logs with 'personal-dropbox.com'.
3. Recommends a specific tuning action (like tightening match thresholds or refining URL categories) or an enforcement escalation for that pattern.
Fail if the agent doesn't use the logs to justify its tuning recommendation.`,
}
