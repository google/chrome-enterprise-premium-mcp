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
  id: 'pr05',
  priority: 'P2',
  tags: ['prompt', 'diagnose'],
  scenario: 'seb-extension-missing',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse:
    'Agent should run the health check and find that the Safe Enterprise Browsing extension is not force-installed. This is a gap in the security posture -- without SEB, data masking DLP features cannot function. Agent should flag this as an issue and recommend deploying the extension.',
  judgeInstructions:
    'The agent MUST identify that the SEB extension is not deployed. If the agent reports extension status as healthy, grade as FAIL. Bonus if the agent connects the missing extension to data masking being unavailable.',
}
