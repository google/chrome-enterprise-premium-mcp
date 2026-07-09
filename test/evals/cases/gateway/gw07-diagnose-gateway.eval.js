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
  id: 'gw07',
  priority: 'P1',
  tags: ['gateway', 'inspection', 'diagnose'],
  fixtures: ['customer-default.json', 'license-valid.json', 'gateways-configured.json'],
  expectedTools: ['diagnose_environment'],
  forbiddenPatterns: [],
  requiredPatterns: ['re:gateway|security gateways'],
  experiments: {
    SECURE_GATEWAY_ENABLED: true,
  },
  prompt:
    'Use the diagnose_environment tool to run a complete diagnostic health check on my Chrome Enterprise Premium deployment, including my Secure Gateway setup in GCP project my-project-123. Summarize the status of my subscription, org units, DLP rules, and Secure Gateways (including gateway and application counts).',
  goldenResponse:
    'The agent should run diagnose_environment with projectId: "my-project-123" and report the Secure Gateway status (1 gateway / Gateway Alpha, 1 application / App One) along with overall environment diagnostic findings.',
  judgeInstructions:
    'The agent must run diagnose_environment with projectId="my-project-123". The response must confirm the presence of the Secure Gateway setup (noting Gateway Alpha, 1 running/active gateway, or 1 application). The judge should evaluate whether the agent accurately summarizes the environment health without penalizing for minor phrasing variations or for listing other detected environment issues.',
}
