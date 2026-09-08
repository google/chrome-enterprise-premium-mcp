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
  id: 'i12',
  priority: 'P1',
  tags: ['inspection', 'discovery'],
  expectedTools: ['security_insights'],
  forbiddenPatterns: [],
  requiredPatterns: [],
  prompt: 'Check if Chrome Security Insights is currently enabled for our organization.',
  goldenResponse:
    'The agent should call the `security_insights` tool with the `action` parameter set to "check" to query the tenant-wide status. It should report back in plain language whether the feature is enabled or disabled.',
  judgeInstructions:
    'Verify the agent reported the enablement state of Chrome Security Insights cleanly in plain language. ' +
    'Do not penalize the agent for omitting tool execution details or raw payload contents.',
}
