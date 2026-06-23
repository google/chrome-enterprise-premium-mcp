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
  id: 'i18',
  priority: 'P1',
  tags: ['inspection', 'discovery', 'crm'],
  scenario: 'no-gcp-organization',
  expectedTools: ['get_customer_id', 'search_organizations'],
  forbiddenPatterns: ['123456789'], // Should not find the default org!
  requiredPatterns: ['console.cloud.google.com', 'accepting the terms of service'],
  prompt:
    'Find the GCP organization associated with our Workspace account. You will need to resolve our customer ID first.',
  goldenResponse:
    'The agent must first call `get_customer_id` to retrieve the Workspace customer ID. ' +
    'It must then call `search_organizations` with that resolved customer ID. ' +
    'Since no organization is found, the agent must explicitly warn the user and suggest creating a new GCP organization, ' +
    'relaying the message that a GCP organization does not exist for their domain yet, and they can create one by ' +
    'navigating to https://console.cloud.google.com/ and accepting the terms of service, which is required for ' +
    'access to Chrome Enterprise Premium features like DLP with CAA conditions and Security Gateway.',
  judgeInstructions:
    'Verify that the agent successfully resolved the customer ID, called `search_organizations`, and ' +
    'upon finding no organization, explicitly prompted the user to create a GCP organization by navigating to ' +
    'https://console.cloud.google.com/ and accepting the terms of service. ' +
    'The response must convey that a GCP organization is required for Chrome Enterprise Premium features.',
}
