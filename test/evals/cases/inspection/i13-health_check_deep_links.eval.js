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
  id: 'i13',
  priority: 'P1',
  tags: ['inspection', 'diagnose'],
  scenario: 'download-connector-missing',
  expectedTools: ['diagnose_environment'],
  prompt:
    'Run a health check on my Chrome Enterprise Premium environment and let me know how to manually configure any gaps you identify.',
  goldenResponse:
    'The agent should run a diagnostic check using `diagnose_environment`, identify that the file download connector is not configured, and proactively provide the direct deep-link to remediate this issue: `https://admin.google.com/ac/chrome/settings/user/details/file_downloaded`.',
  judgeInstructions:
    'The agent MUST run `diagnose_environment` and identify the environment gaps. When describing the missing file download connector, the agent MUST proactively provide the correct direct deep-link to the Google Admin Console for manual remediation: `https://admin.google.com/ac/chrome/settings/user/details/file_downloaded`. Failure to include the link is a FAIL.',
}
