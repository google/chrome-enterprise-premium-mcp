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
  id: 'c02',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'reporting-connector-default',
  expectedTools: ['get_connector_policy'],
  prompt: 'How is my event reporting connector configured for the Root OU?',
  goldenResponse:
    'The Event Reporting connector for the Root OU is active and using default settings. All core security events (like Content transfer, Malware transfer, and Sensitive data transfer) are being reported correctly.',
  judgeInstructions: 'Pass if the agent confirms the connector is active and configured with default core events.',
}
