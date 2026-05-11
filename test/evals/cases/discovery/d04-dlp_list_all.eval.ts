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
  id: 'd04',
  priority: 'P0',
  tags: ['tools', 'dlp'],
  scenario: 'healthy',
  expectedTools: ['list_dlp_rules'],
  prompt: 'Which Chrome DLP rules are currently configured in my organization?',
  goldenResponse: `Your organization has 4 Chrome DLP rules currently configured:
- **Block sensitive file uploads**
- **Watermark confidential documents**
- **Audit pastes to generative AI sites**
- **Warn before uploading PII**`,
  judgeInstructions:
    'Verify that the agent correctly decides to use `list_dlp_rules` based on the user\'s request for "configured rules". The agent should accurately list all 4 rules from the environment.',
}
