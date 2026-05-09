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
  id: 'm02',
  priority: 'P0',
  tags: ['mutation'],
  expectedTools: ['list_org_units', 'create_chrome_dlp_rule'],
  forbiddenPatterns: [],
  requiredPatterns: [],
  prompt:
    'I want to silently monitor when users navigate to social media sites. Set up an audit-only DLP rule on the root OU.',
  goldenResponse:
    'Agent should identify root OU, then create a DLP rule with audit action for URL navigation trigger targeting social media categories. Should confirm creation and explain that audit mode logs events without notifying users.',
  judgeInstructions: `Verify the agent actually performed the action (tool was called), not just
described how to do it. Resource IDs (policy names, OU IDs) are fine to show.
Prefer plain-language confirmation over raw API output.`,
}
