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
  id: 'c12',
  priority: 'P1',
  tags: ['connectors'],
  scenario: 'print-connector-cep-no-delay',
  expectedTools: ['get_connector_policy'],
  prompt: 'Check the configuration of my print connector for the Root OU.',
  goldenResponse:
    'The Print Analysis connector is active, but "Delay Delivery Until Verdict" is disabled. I recommend enabling delay enforcement to ensure that sensitive data is scanned before printing is permitted.',
  judgeInstructions:
    'Pass if the agent identifies the disabled delay enforcement for the print connector and recommends enabling it.',
}
