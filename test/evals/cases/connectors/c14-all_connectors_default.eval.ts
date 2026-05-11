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
  id: 'c14',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'healthy',
  expectedTools: ['get_connector_policy'],
  prompt: 'Get the connector policies for the Root OU without specifying a particular connector type.',
  goldenResponse:
    'Since no specific connector type was requested, all Chrome Enterprise connector policies (File Upload, File Download, Bulk Text Entry, Print Analysis, Real-time URL Check, and Event Reporting) are retrieved and summarized as Configured.',
  judgeInstructions:
    'Pass if the agent retrieves all connector policies when no specific policy/connector type is requested by defaulting to ALL.',
}
