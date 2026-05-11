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
  id: 'pr12',
  priority: 'P2',
  tags: ['prompt', 'noise'],
  scenario: 'healthy',
  promptName: 'cep:optimize',
  expectedTools: ['diagnose_environment', 'get_chrome_activity_log'],
  goldenResponse:
    'Agent should analyze DLP rules and activity logs to assess noise levels. The activity log shows 3 events: one block, one warn, one audit, each from a different rule. With a small number of events spread across multiple rules, there is no obvious high-noise rule. Agent should report current noise levels and recommend continued monitoring.',
  judgeInstructions:
    'The agent MUST examine both DLP rules and activity logs. If the agent fails to fetch the activity log entirely, grade as FAIL. If the agent fetches the log and provides an optimization assessment (even if it focuses more on rule configuration than specific low event counts), it is acceptable and should PASS.',
}
