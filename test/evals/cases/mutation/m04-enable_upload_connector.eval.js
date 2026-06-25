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
  id: 'm04',
  priority: 'P0',
  tags: ['mutation', 'connectors'],
  scenario: 'upload-connector-missing',
  expectedTools: ['enable_chrome_enterprise_connectors'],
  forbiddenPatterns: [],
  requiredPatterns: [],
  prompt:
    'Enable the file-upload connector for the root organizational unit using sensible defaults. If you need to ' +
    'check or ask for confirmation first, proceed immediately as you have my explicit approval.',
  goldenResponse:
    'The agent identified the root organizational unit, then called the connector enablement tool to configure the file-upload connector. It confirmed the connector is now active and briefly described what it does — scanning files users attempt to upload for policy violations — so the admin understands the change that was applied.',
  judgeInstructions:
    'Verify the agent successfully enabled the file-upload connector for the root organizational unit. ' +
    'Do not penalize the agent for checking the current status before enabling or for omitting detailed steps. ' +
    'Resource IDs (OU IDs, connector policy names) are fine to show. Prefer plain-language confirmation ' +
    'over raw API output.',
}
