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
  id: 'gw08',
  priority: 'P1',
  tags: ['gateway', 'mutation'],
  fixtures: ['customer-default.json', 'org-units-complex.json'],
  expectedTools: [
    'create_secure_gateway',
    'create_secure_gateway_application',
    'set_secure_gateway_application_iam_policy',
    'list_org_units',
    'install_seb_extension',
  ],
  forbiddenPatterns: [],
  requiredPatterns: [
    're:gw(-|\\s)saas',
    're:salesforce',
    'roles/beyondcorp.sgApplicationUser',
    're:(user:)?sales@company\\.com',
    're:root\\s+(ou|org|unit|\\/)',
  ],
  experiments: {
    SECURE_GATEWAY_ENABLED: true,
  },
  prompt:
    'I need to configure access to Salesforce (a SaaS application) using the BeyondCorp Secure Gateway in project my-project-123. Please perform the following steps:\n1. Create a secure gateway named gw-saas with display name "SaaS Gateway" and service discovery enabled.\n2. Configure routing for the Salesforce application (applicationId: salesforce). Traffic should route for salesforce.com on port 443 through VPC network projects/my-project-123/global/networks/prod-vpc.\n3. Grant the exact IAM role "roles/beyondcorp.sgApplicationUser" to the exact member "user:sales@company.com" on this salesforce application.\n4. Force-install the BeyondCorp extension (SEB) for the root organizational unit (/) to enable client-side routing to the gateway.',
  goldenResponse:
    'The secure gateway gw-saas has been created. The salesforce application has been configured for salesforce.com on port 443 via the VPC network, and the role roles/beyondcorp.sgApplicationUser has been granted to user:sales@company.com on it. Additionally, the Secure Enterprise Browser (SEB) extension has been force-installed on the Root OU (/) to route browser traffic.',
}
