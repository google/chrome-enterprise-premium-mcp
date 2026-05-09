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
  id: 'c07',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'upload-connector-none',
  expectedTools: ['get_connector_policy'],
  prompt: 'Check the status of my file upload connector for the Root OU. What should I do if it is missing?',
  goldenResponse:
    'The Upload Content Analysis connector is not configured for the Root OU. To protect your organization from data leaks during uploads, I recommend enabling it. Would you like me to do that for you?',
  judgeInstructions: 'Pass if the agent identifies the connector as missing and offers to enable or fix it.',
}
