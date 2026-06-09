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
  id: 'm05',
  priority: 'P0',
  tags: ['mutation'],
  expectedTools: ['security_insights'],
  forbiddenPatterns: [],
  requiredPatterns: [],
  prompt:
    "Please enable Chrome Security Insights for our sub-organizational unit '/Sales' so we can stream its connectors.",
  goldenResponse:
    'The agent should call the `security_insights` tool with `action: "enable"` and `targetOus: ["/Sales"]` ' +
    'specifically targeting the requested sub-OU path. It should confirm in plain language that the setup ' +
    'has been completed.',
  judgeInstructions:
    'Verify the agent indicator that it successfully enabled Security Insights for the requested sub-OU by ' +
    'calling `security_insights` with `action: "enable"` and `targetOus: ["/Sales"]`. ' +
    'Confirm it reported success in plain language.',
}
