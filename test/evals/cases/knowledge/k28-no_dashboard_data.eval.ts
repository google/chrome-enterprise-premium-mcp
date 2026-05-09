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
  id: 'k28',
  priority: 'P2',
  tags: ['troubleshooting', 'dashboard'],
  prompt: `We are not seeing any data in the Chrome security event dashboard. What should
we check locally?`,
  goldenResponse: `On the client device, navigate to \`chrome://policy\` to verify that the browser is receiving the expected security policies. Also, in the Google Admin Console, ensure that 'Event reporting' is enabled under Chrome Browser > Settings > Browser reporting, and confirm the users have Chrome Enterprise Premium licenses assigned and the reporting connector is configured if sending to a SIEM.`,
  judgeInstructions:
    'The agent should suggest relevant client-side and server-side diagnostic steps, such as checking Admin Console reporting settings, verifying license assignment, or verifying policies at chrome://policy.',
}
