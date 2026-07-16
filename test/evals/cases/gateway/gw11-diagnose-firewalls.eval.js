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
  id: 'gw11',
  priority: 'P1',
  tags: ['gateway', 'inspection', 'diagnose', 'firewall'],
  fixtures: ['customer-default.json', 'license-valid.json', 'gateways-configured.json'],
  expectedTools: ['diagnose_environment'],
  forbiddenPatterns: [],
  requiredPatterns: ['re:firewall|gcloud compute firewall-rules|136\\.124\\.16\\.0'],
  experiments: {
    SECURE_GATEWAY_ENABLED: true,
    DIAGNOSE_TOOL_ENABLED: true,
  },
  prompt:
    'My users are reporting that connections to our internal web application routed through the BeyondCorp Secure Gateway in project my-project-123 are timing out. Please run the diagnose_environment tool with projectId "my-project-123" (summary mode) to inspect environment health and diagnose network/firewall issues.',
  goldenResponse:
    'The agent should run diagnose_environment with projectId: "my-project-123" and identify missing VPC ingress firewall rules for the Secure Gateway proxy range (136.124.16.0/20), providing the necessary gcloud firewall-rules create command to remediate.',
  judgeInstructions:
    'The agent must run diagnose_environment with projectId="my-project-123". The agent must identify that an ingress firewall rule for the Secure Gateway proxy range (136.124.16.0/20) or VPC network firewall configuration is missing/requires verification, and provide clear remediation guidance (such as the gcloud command or GCP console URL).',
}
