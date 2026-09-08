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
  id: 'gw03',
  priority: 'P1',
  tags: ['gateway', 'mutation'],
  fixtures: ['customer-default.json'],
  expectedTools: ['create_secure_gateway'],
  forbiddenPatterns: [],
  requiredPatterns: ['re:my(-|\\s)new(-|\\s)gateway', 'my-project-123'],
  experiments: {
    SECURE_GATEWAY_ENABLED: true,
  },
  prompt:
    'Create a new BeyondCorp Secure Gateway named my-new-gateway in Google Cloud project my-project-123. Set the display name to "My New Gateway" and make sure service discovery is enabled. Please confirm the gateway details (including name and project) in your response.',
  goldenResponse: 'Secure gateway my-new-gateway has been successfully created/initiated under project my-project-123.',
}
