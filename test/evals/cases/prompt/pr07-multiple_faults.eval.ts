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
  id: 'pr07',
  priority: 'P2',
  tags: ['prompt', 'diagnose'],
  scenario: 'multiple-faults',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse:
    'Agent should run a comprehensive health check and find multiple issues: (1) the file download connector is not configured, (2) the SEB extension is not force-installed, and (3) bob@example.com is missing a CEP license. A real environment often has multiple gaps, and the agent should identify all of them rather than stopping after finding one.',
  judgeInstructions:
    'The agent MUST identify at least 2 of the 3 issues (missing download connector, missing SEB extension, unlicensed user). Finding only 1 issue is a FAIL. The agent does not need to find all 3 to pass, but identifying all 3 demonstrates thorough investigation.',
}
