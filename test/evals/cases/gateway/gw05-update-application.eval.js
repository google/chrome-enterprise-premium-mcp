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
  id: 'gw05',
  priority: 'P1',
  tags: ['gateway', 'mutation'],
  fixtures: ['customer-default.json'],
  expectedTools: ['update_secure_gateway_application'],
  forbiddenPatterns: [],
  requiredPatterns: ['updated.example.com', 'my-project-123'],
  experiments: {
    SECURE_GATEWAY_ENABLED: true,
  },
  prompt:
    'Update the private web application "app-1" on secure gateway "test-gateway" in project "my-project-123" to set its hostname to "updated.example.com" and port to 8443. Confirm the application update in your response.',
  goldenResponse:
    'Application app-1 on gateway test-gateway has been updated with hostname updated.example.com and port 8443 in project my-project-123.',
}
