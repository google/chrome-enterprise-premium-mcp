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
  id: 'pr19',
  priority: 'P1',
  tags: ['prompt', 'diagnose'],
  scenario: 'no-subscription',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse: `Agent should identify no CEP licenses assigned as a critical
issue. This is the most fundamental problem — without licenses,
no CEP features are active for any user. The agent should
recommend purchasing and assigning licenses as the top priority.`,
  judgeInstructions: `The agent MUST flag the missing subscription as a critical
issue. If it reports the environment as healthy or focuses
on other issues without mentioning the licensing gap, grade
as FAIL.`,
}
