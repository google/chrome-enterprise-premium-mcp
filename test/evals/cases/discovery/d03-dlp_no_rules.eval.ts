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
  id: 'd03',
  priority: 'P2',
  tags: ['tools', 'dlp', 'empty-state'],
  scenario: 'no-dlp-rules',
  expectedTools: ['list_dlp_rules'],
  prompt: 'List my configured Chrome DLP rules.',
  goldenResponse: 'No Chrome DLP rules were found in this organization.',
  judgeInstructions: 'The agent must clearly and accurately state that no rules were found.',
}
