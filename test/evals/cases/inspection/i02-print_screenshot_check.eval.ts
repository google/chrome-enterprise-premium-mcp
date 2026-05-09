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
  id: 'i02',
  priority: 'P2',
  tags: ['inspection'],
  expectedTools: ['list_dlp_rules', 'get_connector_policy'],
  prompt:
    'Can CEP prevent users from taking screenshots or printing sensitive data? Check if we have any protections active.',
  goldenResponse:
    "Yes, Chrome Enterprise Premium can prevent or warn on these actions. You can use Data Loss Prevention (DLP) rules with the 'Content printed' trigger. For screenshots and screen-sharing, this is often configured within a DLP rule as an additional action when a user visits sensitive URLs. The agent's check of your current DLP rules indicates no active rules for printing or screenshot protection. You would need to create or modify rules to include these protections.",
}
