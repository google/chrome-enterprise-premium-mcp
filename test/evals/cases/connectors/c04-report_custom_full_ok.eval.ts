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
  id: 'c04',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'reporting-connector-customized-full',
  expectedTools: ['get_connector_policy'],
  prompt: 'How is my event reporting connector configured for the Root OU?',
  goldenResponse:
    'The Event Reporting connector is configured to report all 7 core security events. Your configuration is correct and provides complete coverage for security monitoring with no warnings issued.',
  judgeInstructions: 'Pass if the agent confirms that all core events are being reported and issues no warnings.',
}
