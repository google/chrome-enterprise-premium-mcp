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
  id: 'pr16',
  priority: 'P1',
  tags: ['prompt', 'diagnose'],
  scenario: 'all-connectors-disabled',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse: `Agent should identify that no content analysis connectors are
configured despite active DLP rules. File uploads, downloads,
paste operations, print jobs, and URL checks are all unprotected.
This is a critical gap — DLP rules exist but cannot trigger
because the connectors that feed content to the scanning engine
are missing. Agent should recommend enabling all relevant
connectors.`,
  judgeInstructions: `The agent MUST identify the complete absence of connectors as a
critical issue, not just flag one missing connector. It should
convey that DLP rules are effectively non-functional without
connectors. If the agent only mentions a single missing connector
or reports the environment as partially healthy, grade as FAIL.`,
}
