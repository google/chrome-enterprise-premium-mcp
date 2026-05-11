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
  id: 'pr04',
  priority: 'P2',
  tags: ['prompt', 'diagnose'],
  scenario: 'user-missing-license',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse:
    'Agent should run the health check and find that only 1 of 2 expected users has a CEP license (alice@example.com has one, bob@example.com does not). Agent should flag the licensing gap as an issue requiring attention.',
  judgeInstructions:
    'The agent MUST identify a licensing issue. If the agent reports all licenses as healthy without noting that bob@example.com is unlicensed, grade as FAIL. The specific user does not need to be named if the agent identifies a general licensing gap.',
}
