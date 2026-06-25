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
  id: 'm06',
  priority: 'P1',
  tags: ['mutation'],
  expectedTools: ['security_insights'],
  forbiddenPatterns: [],
  requiredPatterns: [],
  prompt:
    'Please enable Chrome Security Insights for our tenant. However, if it is already enabled, do not trigger another enable request and just let me know the current status.',
  goldenResponse:
    'The agent should first query the global enablement status by calling `security_insights` with `action: "check"`. In this test context (where initial mock state is disabled), it should proceed to call `security_insights` with `action: "enable"`. If it were already enabled, it should stop and notify.',
  judgeInstructions:
    'Verify the agent called `security_insights` with `action: "check"` to verify the status first. Since the backend defaults to disabled, it should then call `action: "enable"`. Grade as PASS as long as both tool calls were executed and it confirmed in plain language that Security Insights was enabled (e.g. noting that it was previously disabled). Do not penalize the agent if it omits raw API output in its response text.',
}
