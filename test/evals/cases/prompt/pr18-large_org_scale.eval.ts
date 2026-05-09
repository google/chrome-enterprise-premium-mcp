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
  id: 'pr18',
  priority: 'P2',
  tags: ['prompt', 'diagnose', 'scale'],
  scenario: 'large-org',
  promptName: 'cep:health',
  expectedTools: ['diagnose_environment'],
  goldenResponse: `Agent should handle an enterprise-scale environment (~200 OUs,
30 DLP rules with messy names, 10 detectors, 8 browser versions,
5000 licenses) without crashing or truncating. It should report
the scale accurately, identify the 4 inactive rules (including
2 that are clearly test/cleanup candidates), and summarize
rather than enumerate every item.`,
  judgeInstructions: `The agent must complete the health check without errors and
report the environment's scale. It should identify inactive
rules. Noting the messy rule names ("DELETE ME", "DO NOT USE")
as cleanup candidates is a plus but not required. Exact counts
may vary slightly. If the agent crashes, errors, or reports
the environment as small/simple, grade as FAIL.`,
}
