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
  id: 'pr21',
  priority: 'P1',
  tags: ['prompt', 'diagnose', 'proactive'],
  scenario: 'upload-connector-missing',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse:
    'Agent should run the health check, identify that the upload content analysis connector is not configured, and proactively offer to enable the connector for the administrator upon their explicit approval (e.g. I can enable the File Upload connector for you now if you would like).',
  judgeInstructions:
    'The agent MUST identify the health gap AND explicitly offer to execute the remediation step for the user upon their approval. If the agent only reports findings or lists remediation actions without proactively offering to perform them for the user, grade as FAIL.',
}
