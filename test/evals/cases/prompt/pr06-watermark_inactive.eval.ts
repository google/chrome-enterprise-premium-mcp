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
  id: 'pr06',
  priority: 'P2',
  tags: ['prompt', 'diagnose'],
  scenario: 'watermark-rule-inactive',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse:
    'Agent should run the health check and find the "Watermark confidential documents" DLP rule exists but has state INACTIVE. Three other DLP rules are active. Agent should flag the inactive rule as an issue since it is not providing the intended protection for printed confidential content.',
  judgeInstructions:
    'The agent MUST identify that an inactive rule exists (it may be referred to as the watermark rule or simply an inactive rule). Simply reporting "4 DLP rules found" without noting the inactive state is a FAIL. The agent should recommend activating it.',
}
