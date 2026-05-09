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
  id: 's04',
  priority: 'P1',
  tags: ['api', 'remediation', 'core'],
  scenario: 'some-cep-apis-disabled',
  expectedTools: ['check_and_enable_cep_api'],
  requiredPatterns: ['chromemanagement.googleapis.com', 'chromepolicy.googleapis.com', 'my-test-project'],
  prompt: 'Check the Google Cloud APIs for my project my-test-project.',
  goldenResponse: `Agent should run \`check_and_enable_cep_api\` (without \`enable: true\` since the user hasn't authorized it yet). It should identify that \`chromemanagement.googleapis.com\` and \`chromepolicy.googleapis.com\` are disabled (while others like \`admin.googleapis.com\` and \`serviceusage.googleapis.com\` are enabled) for project \`my-test-project\`.
It must ask the user if they would like the agent to automatically enable these two missing APIs for them.`,
  judgeInstructions: `Verify that the agent:
- Identifies that \`chromemanagement.googleapis.com\` and \`chromepolicy.googleapis.com\` are disabled.
- Explicitly asks the user if they would like the agent to automatically enable these APIs.`,
}
