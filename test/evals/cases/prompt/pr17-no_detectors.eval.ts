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
  id: 'pr17',
  priority: 'P2',
  tags: ['prompt', 'diagnose'],
  scenario: 'no-detectors',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse: `The agent should run the health check and find 4 active DLP rules, but zero custom content detectors. While it's perfectly valid to have DLP rules without custom detectors, if an active rule explicitly references a detector that does not exist, that rule will fail to trigger. The agent should warn the user about this broken reference.`,
  judgeInstructions: `Grade as PASS if the agent performs a reasonable health check and summarizes the environment.

To earn an Excellent grade, the agent must specifically notice the broken reference: active DLP rules exist that rely on custom detectors, but \`list_detectors\` returns empty. The agent should NOT penalize the environment if no rules require detectors.`,
}
