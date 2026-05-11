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
  id: 'pr01',
  priority: 'P2',
  tags: ['prompt', 'diagnose'],
  scenario: 'healthy',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse:
    'The base state is a fully healthy environment. Agent should report: 3 OUs configured, 4 active DLP rules, all connectors configured (file upload, file download, bulk text, print, URL check, security events), SEB extension force-installed, CEP subscription active with 2 licenses, browser versions current. The health check should show mostly green/healthy status with no critical issues.',
  judgeInstructions:
    'This is a healthy environment. The agent should report a clean bill of health across all checked areas. If the agent flags critical or high-severity issues that do not actually exist in the data, grade as FAIL. Minor recommendations (e.g., "consider adding more DLP rules") are acceptable.',
}
