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
  id: 'c09',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'upload-connector-cep-restricted',
  expectedTools: ['get_connector_policy'],
  prompt: 'Check the status of my file upload connector for the Root OU.',
  goldenResponse:
    'The Upload Content Analysis connector is active, but scanning is restricted for certain URL patterns in your Malware and Sensitive data settings. This creates potential blind spots. I recommend reviewing these allowlists in the Admin Console.',
  judgeInstructions: 'Pass if the agent identifies and warns about restricted scanning or URL allowlists.',
}
