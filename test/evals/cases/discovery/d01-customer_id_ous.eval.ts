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
  id: 'd01',
  priority: 'P0',
  tags: ['discovery'],
  fixtures: ['customer-default.json', 'org-units-complex.json'],
  expectedTools: ['get_customer_id', 'list_org_units'],
  forbiddenPatterns: [],
  requiredPatterns: ['C01b1e65b', 'Engineering-Test-07b4581a'],
  prompt: 'What is my customer ID and how are my organizational units structured?',
  goldenResponse: 'Customer ID is C01b1e65b. Organizational units include Engineering-Test-07b4581a and cep-netnew.cc.',
}
