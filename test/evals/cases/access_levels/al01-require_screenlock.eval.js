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
  id: 'al01',
  priority: 'P1',
  tags: ['access_levels', 'mutation'],
  scenario: 'healthy',
  expectedTools: ['create_caa_access_level'],
  experiments: {
    ACM_TOOLS_ENABLED: true,
  },
  prompt:
    'Create a Context-Aware Access level named require_screenlock_level titled "Require Screen Lock" that requires devices to have a screenlock enabled.',
  goldenResponse:
    'The agent should call create_caa_access_level (or list_caa_access_levels first to check existing levels) with requireScreenlock set to true and confirm the access level creation in plain language.',
}
