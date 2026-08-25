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
  id: 'gw13',
  priority: 'P1',
  tags: ['gateway', 'inspection', 'diagnose'],
  fixtures: ['customer-default.json', 'license-valid.json', 'gateways-configured.json'],
  expectedTools: ['diagnose_environment'],
  forbiddenPatterns: [],
  requiredPatterns: ['re:gateway|security gateways', 're:seb|extension|browser'],
  experiments: {
    SECURE_GATEWAY_ENABLED: true,
  },
  prompt:
    'Run a diagnostic health check on our BeyondCorp Secure Gateway deployment in GCP project my-project-123 using diagnose_environment. Specifically verify whether client browsers have the SEB extension and routing policy configured and report any proxy or routing issues.',
  goldenResponse:
    'The agent should call diagnose_environment with projectId: "my-project-123", review the Secure Gateway status and SEB extension policy, and summarize whether client browser routing is configured and whether any proxy conflicts exist.',
  judgeInstructions:
    'The agent must call diagnose_environment with projectId="my-project-123". The response should assess the Secure Gateway deployment and address whether client browser routing (SEB extension or proxy settings) is properly configured.',
}
