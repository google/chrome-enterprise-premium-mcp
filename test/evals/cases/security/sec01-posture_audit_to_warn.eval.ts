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
  id: 'sec01',
  priority: 'P1',
  tags: ['security', 'posture', 'logs'],
  scenario: 'maturity-step-3-tuning',
  expectedTools: ['diagnose_environment', 'get_document', 'get_chrome_activity_log'],
  prompt: "I've set up some baseline audit rules. What should my next steps be to improve our security posture?",
  goldenResponse: `The agent should first perform a diagnostic check and consult the security posture heuristics (document 12).
It should then analyze the Chrome activity logs and notice the recurring sensitive file uploads to \`personal-dropbox.com\`.
The recommendation should include tightening the existing audit rules or creating a new rule to \`WARN\` or \`BLOCK\` (as per Step 3 or 4 of the posture guide) specifically for high-risk domains like Dropbox, since they are already appearing in the audit logs with sensitive content names like 'secret_project.pdf' and 'passwords.txt'.`,
  judgeInstructions: `Grade as PASS if the agent:
1. Calls 'diagnose_environment' and 'get_document' for document 12.
2. Calls 'get_chrome_activity_log' to anchor its recommendations.
3. Specifically mentions the activity related to 'personal-dropbox.com' or the sensitive files ('secret_project.pdf', 'passwords.txt') found in the logs.
4. Suggests moving from 'AUDIT' to 'WARN' or 'BLOCK' for these specific risky data flows as a next step.
Fail if the agent ignores the activity logs or provides generic advice not anchored in the provided log data.`,
}
