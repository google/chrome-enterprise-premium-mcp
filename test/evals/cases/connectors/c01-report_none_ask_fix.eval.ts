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
  id: 'c01',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'reporting-connector-none',
  expectedTools: ['get_connector_policy'],
  prompt: 'How is my event reporting connector configured for the Root OU? What should I do if it is not set up?',
  goldenResponse:
    'The Event Reporting connector is not currently configured for the Root Organizational Unit. This means security events are not being reported to the Admin Console. I recommend enabling this connector so you can receive security telemetry. Would you like me to fix this for you?',
  judgeInstructions:
    'Pass if the agent identifies the connector as not configured and offers to fix or enable it for the user.',
}
