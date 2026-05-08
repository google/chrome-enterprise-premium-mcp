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
  id: 'c11',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'paste-connector-3p-trellix',
  expectedTools: ['get_connector_policy'],
  prompt: 'Audit my paste (bulk text entry) connector for the Root OU.',
  goldenResponse:
    'Your bulk text entry (paste) analysis is currently managed by a 3rd party provider (Trellix). Integrated Chrome Enterprise Premium protections might be bypassed in this configuration.',
  judgeInstructions:
    'Pass if the agent identifies the 3rd party provider and issues a warning about potential feature bypass.',
}
