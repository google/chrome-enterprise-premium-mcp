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
  id: 'pr20',
  priority: 'P2',
  tags: ['prompt', 'diagnose'],
  scenario: 'upload-connector-missing',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse: `Agent should identify that the file upload content analysis
connector is not configured. File uploads go unscanned, meaning
DLP rules with upload triggers cannot detect sensitive content.
The download connector IS configured, so only uploads are the gap.`,
  judgeInstructions: `The agent MUST identify the missing upload connector as an issue.
If it reports all connectors as healthy, grade as FAIL. Noting
that the download connector is active while upload is missing
is a plus but not required.`,
}
