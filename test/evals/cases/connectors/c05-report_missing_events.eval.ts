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
  id: 'c05',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'reporting-connector-customized-partial',
  expectedTools: ['get_connector_policy'],
  prompt: 'How is my event reporting connector configured for the Root OU?',
  goldenResponse:
    'The Event Reporting connector is configured but is missing several core security events. Specifically, it is not reporting: Content unscanned, Malware transfer, Sensitive data transfer, Unsafe site visit, URL filtering interstitial, and Suspicious URL. I recommend updating these settings in the Admin Console to ensure full visibility.',
  judgeInstructions:
    'Pass if the agent provides a warning listing the specific core events that are missing from the configuration.',
}
