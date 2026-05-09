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
  id: 's05',
  priority: 'P1',
  tags: ['api', 'remediation', 'prereq'],
  scenario: 'service-usage-disabled',
  expectedTools: ['check_and_enable_cep_api'],
  requiredPatterns: [
    'Service Usage API',
    'https://console.cloud.google.com/apis/library/serviceusage.googleapis.com',
    'project=my-test-project',
  ],
  prompt: 'Check my Google Cloud APIs for project my-test-project.',
  goldenResponse: `Agent should attempt to call \`check_and_enable_cep_api\`. It should detect a Service Usage API failure and recognize that \`serviceusage.googleapis.com\` itself is disabled on the project. Since this prerequisite API cannot be automatically enabled, it must provide the exact Cloud Console link:
\`https://console.cloud.google.com/apis/library/serviceusage.googleapis.com?project=my-test-project\`
and clearly instruct the user to manually enable it in the browser.`,
  judgeInstructions: `Verify that the agent identifies that the prerequisite Service Usage API is disabled. The agent must guide the user to enable it manually and provide the console link including the correct project ID \`my-test-project\`.`,
}
