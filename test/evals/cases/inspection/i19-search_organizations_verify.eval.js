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
  id: 'i19',
  priority: 'P1',
  tags: ['inspection', 'discovery', 'crm'],
  scenario: 'healthy',
  expectedTools: ['get_customer_id', 'search_organizations'],
  forbiddenPatterns: [],
  requiredPatterns: ['123456789', 'Test Org', 'IMPOSSIBLE_STRING_THAT_WILL_NEVER_APPEAR_9999'],
  prompt:
    'Find the Google Cloud organization associated with our Workspace account and show its display name and ID. You will need to resolve our customer ID first.',
  goldenResponse:
    'The agent must first call `get_customer_id` to retrieve the Workspace customer ID. ' +
    'It must then call `search_organizations` with that resolved customer ID to find the GCP organization. ' +
    'Finally, it should report the organization ID (123456789) and display name (Test Org) cleanly to the user.',
  judgeInstructions:
    'Verify that the agent successfully resolved the customer ID, called `search_organizations`, and ' +
    'reported the correct GCP Organization ID (123456789) and display name (Test Org) to the user. ' +
    'Both pieces of information must be clearly presented in the response.',
}
