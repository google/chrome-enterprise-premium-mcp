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
  id: 'pr03',
  priority: 'P2',
  tags: ['prompt', 'diagnose'],
  scenario: 'reporting-connector-missing',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse:
    'Agent should run the full health check and identify that the security event reporting connector (OnSecurityEvent) is not configured. Without this, no security events are forwarded to SIEM. Agent should flag this as an issue and recommend configuring the reporting connector.',
  judgeInstructions:
    'The agent MUST identify that security event reporting is not configured. If the agent reports all connectors as healthy without noting the missing reporting/security event connector, grade as FAIL.',
}
