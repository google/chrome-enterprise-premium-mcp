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
  id: 'b07',
  priority: 'P1',
  tags: ['persona', 'technical-explanation'],
  expectedTools: ['list_dlp_rules'],
  scenario: 'healthy',
  prompt: 'Tell me about my active DLP rules and explain what their technical conditions actually mean.',
  goldenResponse: `The agent should list the active rules and provide a plain-language explanation for their conditions. For example, it should explain that \`all_content.matches_dlp_detector("projects/example/detectors/ssn")\` means the rule is checking for Social Security Numbers.`,
  judgeInstructions: `The agent MUST include a user-friendly explanation for any technical configuration details or CEL syntax it surfaces. If it provides raw CEL without a corresponding explanation of its purpose, grade as FAIL.`,
}
