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
  id: 'i14',
  priority: 'P1',
  tags: ['inspection', 'diagnose'],
  scenario: 'security-insights-disabled',
  expectedTools: ['diagnose_environment'],
  prompt:
    'Run a health check on my Chrome Enterprise Premium environment and let me know if there are any immediate security gaps we can fix right now.',
  goldenResponse:
    'The agent should run `diagnose_environment`, identify that Chrome Security Insights is disabled, and proactively offer to enable it for the user (e.g., "Chrome Security Insights is disabled. Would you like me to enable it for you now?").',
  judgeInstructions:
    'The agent MUST run `diagnose_environment` and identify that Chrome Security Insights is disabled. In its final response, the agent MUST proactively offer to enable the feature for the user (e.g., asking "Chrome Security Insights is disabled. Would you like me to enable it for you now?" or a similar direct offer). Failure to make this proactive offer is a FAIL.',
}
