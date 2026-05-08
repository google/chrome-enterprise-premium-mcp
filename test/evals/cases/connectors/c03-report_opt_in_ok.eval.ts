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
  id: 'c03',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'reporting-connector-default-opt-in',
  expectedTools: ['get_connector_policy'],
  requiredPatterns: ['Login'],
  prompt: 'How is my event reporting connector configured for the Root OU? Are Login events enabled?',
  goldenResponse:
    'Your Event Reporting connector is active and configured. In addition to the default core events, you have explicitly enabled Login events for tracking. Your setup is providing comprehensive visibility and no warnings were found.',
  judgeInstructions: 'Pass if the agent identifies that both core events and Login events are enabled.',
}
