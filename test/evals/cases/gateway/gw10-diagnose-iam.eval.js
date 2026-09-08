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
  id: 'gw10',
  priority: 'P1',
  tags: ['gateway', 'inspection', 'diagnose', 'iam'],
  fixtures: ['customer-default.json', 'license-valid.json', 'gateways-configured.json'],
  expectedTools: ['diagnose_environment'],
  forbiddenPatterns: [],
  requiredPatterns: ['re:gateway|security gateways', 're:upstreamAccess|IAM|permission|role|HTTP|HTTPS|unencrypted'],
  experiments: {
    SECURE_GATEWAY_ENABLED: true,
  },
  prompt:
    'My users are having trouble connecting to our private web app via Secure Gateway in GCP project my-project-123. Please run the diagnose_environment tool to check for IAM or configuration issues preventing traffic.',
  goldenResponse:
    'The agent should run diagnose_environment for project my-project-123 and report identified configuration or IAM issues (such as unencrypted HTTP upstream or missing delegating service account IAM role) along with actionable remediation guidance.',
  judgeInstructions:
    'The agent must execute diagnose_environment for project my-project-123. The response must accurately explain at least one of the major identified diagnostic issues (such as unencrypted HTTP upstream on App One or missing delegating service account IAM role) and provide actionable remediation guidance. The judge should NOT penalize the agent if it does not explicitly repeat the project ID in the final text response as long as diagnose_environment was called.',
}
