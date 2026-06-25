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
  id: 'gw02',
  priority: 'P1',
  tags: ['gateway', 'discovery'],
  fixtures: ['customer-default.json', 'gateways-configured.json'],
  expectedTools: ['get_secure_gateway', 'list_secure_gateway_applications'],
  forbiddenPatterns: [],
  requiredPatterns: ['re:gateway(-|\\s)?alpha', 'app-one', 'intranet.company.com'],
  experiments: {
    SECURE_GATEWAY_ENABLED: true,
  },
  prompt:
    'What are the details and configured applications for secure gateway gateway-alpha in project my-project-123?',
  goldenResponse:
    'Gateway Alpha (gateway-alpha) is ACTIVE. It has 1 configured application called App One (app-one) routing to intranet.company.com.',
}
