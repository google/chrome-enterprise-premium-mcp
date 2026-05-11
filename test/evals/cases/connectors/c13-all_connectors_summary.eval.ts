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
  id: 'c13',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'healthy',
  expectedTools: ['get_connector_policy'],
  prompt: 'Show me a summary of all Chrome Enterprise connector policies at once for the Root OU.',
  goldenResponse:
    'A structured summary of all Chrome Enterprise connector policies for the Root OU containing File Upload, File Download, Bulk Text Entry, Print Analysis, Real-time URL Check, and Event Reporting connectors, indicating they are all Configured.',
  judgeInstructions:
    'Pass if the agent retrieves all 6 connector policies using get_connector_policy with policy "ALL" (or by default) and lists or summarizes their status correctly.',
}
