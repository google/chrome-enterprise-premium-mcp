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
  id: 'k07',
  priority: 'P1',
  tags: ['iam', 'roles'],
  requiredPatterns: ['Security Center Admin', 'DLP'],
  prompt: `Our Helpdesk team needs to view CEP security dashboards and adjust DLP rules,
but we cannot give them 'Super Admin' access. What roles are required?`,
  goldenResponse: `Use delegated administrator roles rather than Super Admin:

- **Viewing dashboards:** Assign the Security Center Admin (Custom Role).
- **Managing DLP rules:** Assign the DLP Administrator (Custom Role).`,
  judgeInstructions: `The agent must recommend delegated roles or custom roles for dashboard viewing and DLP management. The agent MUST specifically mention 'Security Center Admin' and either 'DLP Administrator' or 'Cloud BeyondCorp Admin'.`,
}
