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
  id: 'm07',
  priority: 'P1',
  tags: ['mutation'],
  scenario: 'security-insights-enabled',
  expectedTools: ['security_insights'],
  forbiddenPatterns: [],
  requiredPatterns: [],
  prompt: 'Turn off and completely disable Chrome Security Insights for our tenant.',
  goldenResponse:
    'The agent should call the `security_insights` tool with `action: "disable"`. It should confirm in plain language that Chrome Security Insights has been successfully disabled.',
  judgeInstructions:
    'Verify the agent reported that it successfully disabled Chrome Security Insights. ' +
    'Do not penalize the agent for omitting tool execution details or raw payload contents.',
}
