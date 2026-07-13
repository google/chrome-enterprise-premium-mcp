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
  id: 'i20',
  priority: 'P1',
  tags: ['inspection', 'extension'],
  scenario: 'healthy',
  expectedTools: ['check_ev_extension_status'],
  prompt: 'Check if the Endpoint Verification extension is force-installed for the root OU.',
  goldenResponse:
    'The agent should call the `check_ev_extension_status` tool for the root OU. It should report that the Endpoint Verification extension (ID `callobklhcbilhphinckomhgkigmfocg`) is NOT force-installed. It should recommend force-installing the extension and explain that it is required for Context-Aware Access (CAA) levels to be enforced.',
  judgeInstructions:
    'Verify that the agent called `check_ev_extension_status` for the root OU and reported that the Endpoint Verification extension is NOT force-installed. The agent MUST recommend force-installing the extension and explain that it is required for Context-Aware Access (CAA) levels to be enforced.',
}
