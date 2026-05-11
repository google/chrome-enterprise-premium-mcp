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
  id: 'i04',
  priority: 'P0',
  tags: ['inspection'],
  expectedTools: ['diagnose_environment'],
  prompt:
    'Run a health check on my Chrome Enterprise Premium deployment. Check my subscription, org structure, browser versions, and DLP rules.',
  goldenResponse:
    'Agent should attempt a comprehensive check. It should report on the areas: Active subscription, 2 OUs configured, Browser versions (either total counts or specific breakdown), and 1 DLP rule identified as "Active".',
  judgeInstructions:
    'This is a comprehensive health check. The agent should use diagnose_environment and synthesize findings into a summary. It should report the active subscription status, OUs, browser version information, and DLP rule status, providing a cohesive summary of the successful findings.',
}
