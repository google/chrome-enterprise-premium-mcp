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
  id: 'm01',
  priority: 'P0',
  tags: ['mutation'],
  expectedTools: ['list_org_units', 'create_chrome_dlp_rule'],
  forbiddenPatterns: [],
  requiredPatterns: [],
  prompt:
    'Create a DLP rule that warns users when they try to upload files containing credit card numbers. Apply it to the root organizational unit.',
  goldenResponse:
    'Agent should identify the root OU, then create a DLP rule with warn action for file upload trigger with a content condition for credit card patterns. Should confirm the rule was created successfully. Resource IDs (policy names, OU IDs) are fine to show.',
  judgeInstructions: `Verify the agent actually performed the action (tool was called), not just
described how to do it. Resource IDs (policy names, OU IDs) are fine to show.
Prefer plain-language confirmation over raw API output.`,
}
