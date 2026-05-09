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
  id: 'i11',
  priority: 'P2',
  tags: ['tools', 'dlp'],
  scenario: 'healthy',
  expectedTools: ['list_dlp_rules'],
  prompt: 'What are the API resource names for my configured rules?',
  goldenResponse: `The resource names are:
- **Block sensitive file uploads**: \`policies/dlpBlock1\`
- **Watermark confidential documents**: \`policies/dlpWatermark1\`
- **Audit pastes to generative AI sites**: \`policies/dlpAuditGenAI\`
- **Warn before uploading PII**: \`policies/dlpWarnPII\``,
  judgeInstructions:
    'The agent must accurately extract the technical resource names from the tool\'s output. This verifies it can read the "Resource names for API operations" section of the tool\'s response.',
}
