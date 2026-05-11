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
  id: 'pr02',
  priority: 'P2',
  tags: ['prompt', 'diagnose'],
  scenario: 'download-connector-missing',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse:
    'Agent should run the full health check and identify that the file download connector is not configured while the file upload connector is active. This is a gap in content analysis coverage. Agent should flag this as a high or critical issue and recommend enabling the download connector.',
  judgeInstructions:
    'The agent MUST identify the missing download connector as an issue. If the health check reports all connectors as healthy, grade as FAIL. Other findings about the healthy parts of the environment are expected and fine.',
}
