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
  id: 'gw06',
  priority: 'P1',
  tags: ['gateway', 'mutation'],
  fixtures: ['customer-default.json', 'gateways-configured.json'],
  expectedTools: [
    'get_secure_gateway_iam_policy',
    'set_secure_gateway_iam_policy',
    'get_secure_gateway_application_iam_policy',
    'set_secure_gateway_application_iam_policy',
  ],
  forbiddenPatterns: [],
  requiredPatterns: [
    'roles/beyondcorp.serviceDiscoveryUser',
    'group:all-users@example.com',
    'roles/beyondcorp.sgApplicationUser',
    'user:bob@company.com',
  ],
  experiments: {
    SECURE_GATEWAY_ENABLED: true,
  },
  prompt:
    'I want to manage access for secure gateway gateway-alpha in project my-project-123. First, show me the current gateway-level policy. Then grant roles/beyondcorp.serviceDiscoveryUser to group:all-users@example.com on it. After that, retrieve the IAM policy for application app-one on that gateway, and grant roles/beyondcorp.sgApplicationUser to user:bob@company.com on that application.',
  goldenResponse:
    'The gateway-level policy has been updated with roles/beyondcorp.serviceDiscoveryUser for group:all-users@example.com. The application-level policy for app-one has been updated to include user:bob@company.com with roles/beyondcorp.sgApplicationUser.',
}
