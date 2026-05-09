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
  id: 'd05',
  priority: 'P1',
  tags: ['tools', 'dlp'],
  scenario: 'healthy',
  expectedTools: ['list_dlp_rules'],
  prompt: 'Which browser actions are we currently monitoring for data protection?',
  goldenResponse: `We are currently monitoring the following browser actions using Chrome DLP rules:
- **FILE_UPLOAD** (Block sensitive file uploads, Warn before uploading PII)
- **PRINT** (Watermark confidential documents)
- **WEB_CONTENT_UPLOAD** (Audit pastes to generative AI sites)`,
  judgeInstructions:
    'The agent must identify the specific browser actions (triggers) being monitored by examining the current DLP rules. It should correctly associate the rules with their respective actions (uploads, printing, pastes).',
}
