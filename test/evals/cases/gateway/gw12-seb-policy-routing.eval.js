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
  id: 'gw12',
  priority: 'P1',
  tags: ['gateway', 'mutation', 'extension'],
  fixtures: ['customer-default.json', 'org-units-complex.json', 'gateways-configured.json'],
  expectedTools: ['check_seb_extension_status', 'install_seb_extension'],
  forbiddenPatterns: [],
  requiredPatterns: ['re:gateway(-|\\s)alpha', 're:root\\s+(ou|org|unit|\\/)'],
  experiments: {
    SECURE_GATEWAY_ENABLED: true,
  },
  prompt:
    'Check the Secure Enterprise Browser (SEB) extension on the root organizational unit (/), and configure it with client routing for BeyondCorp Secure Gateway gateway-alpha in project my-project-123 with service discovery enabled. You have my explicit approval to apply the configuration directly.',
  goldenResponse:
    'The agent should check the SEB extension status using check_seb_extension_status on the root OU (/), determine whether the routing policy is configured, and call install_seb_extension with projectId: "my-project-123", gatewayId: "gateway-alpha", and enableServiceDiscovery: true to configure it on the root OU.',
  judgeInstructions:
    'The agent must inspect the SEB extension status on the root OU using check_seb_extension_status and configure client routing using install_seb_extension with projectId="my-project-123" and gatewayId="gateway-alpha" on the root OU (/).',
}
