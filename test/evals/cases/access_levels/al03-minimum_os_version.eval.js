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
  id: 'al03',
  priority: 'P1',
  tags: ['access_levels', 'mutation'],
  scenario: 'healthy',
  expectedTools: ['create_caa_access_level'],
  experiments: {
    ACM_TOOLS_ENABLED: true,
  },
  prompt:
    'Create a Context-Aware Access level named min_mac_os_level titled "Minimum Mac OS Version" that requires macOS devices to have a minimum OS version of 10.0.0.',
  goldenResponse:
    'The agent should call create_caa_access_level (or list_caa_access_levels first to check existing levels) with osConstraints specifying DESKTOP_MAC and minimumVersion 10.0.0, and confirm the access level creation in plain language. It is acceptable for the agent to include the full API resource path or name in its response.',
  judgeInstructions:
    'Verify that the agent created the access level with osConstraints specifying DESKTOP_MAC and minimumVersion 10.0.0. It is acceptable and valid for the agent to output full API resource names or paths (e.g. accessPolicies/10001/accessLevels/min_mac_os_level) in its response; do not penalize for outputting technical resource names or paths.',
}
