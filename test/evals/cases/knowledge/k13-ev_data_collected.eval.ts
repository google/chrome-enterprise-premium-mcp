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
  id: 'k13',
  priority: 'P2',
  tags: ['ev', 'privacy'],
  prompt: 'What exact information does the Endpoint Verification extension collect from employee devices?',
  goldenResponse:
    'Endpoint Verification collects device posture attributes such as OS type and version, device ID, serial number, screen lock status, disk encryption status, and more. It does _not_ collect personal browsing history or file contents. A comprehensive list of collected attributes is available in the [Device attributes collected by Endpoint Verification](https://cloud.google.com/endpoint-verification/docs/device-information) documentation.',
  judgeInstructions:
    'The agent must list the core attributes collected and explicitly state that personal data like browsing history is NOT collected. The agent is NOT required to provide the link to the documentation, as long as the core facts are accurate.',
}
