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
  id: 'i09',
  priority: 'P1',
  tags: ['tools', 'dlp'],
  scenario: 'healthy',
  expectedTools: ['list_dlp_rules'],
  prompt: 'Show me the rules that monitor data during browser uploads.',
  goldenResponse: `You have two rules monitoring data during uploads:
1. **Block sensitive file uploads**
2. **Warn before uploading PII**`,
  judgeInstructions:
    'The agent must identify the rules that specifically target "uploads" (FILE_UPLOAD trigger) as mentioned in the tool\'s description.',
}
