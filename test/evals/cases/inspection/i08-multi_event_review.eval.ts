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
  id: 'i08',
  priority: 'P2',
  tags: ['dlp', 'activity'],
  fixtures: ['dlp-activities-multi.json'],
  expectedTools: ['get_chrome_activity_log'],
  prompt: `Review recent Chrome security events. Are there any DLP violations or content
scanning issues I should know about?`,
  goldenResponse: `Agent should report 5 events across 3 users: two blocks (alice uploading payroll
and SSN files to external sites), one warn (bob uploading a customer list), one
unscanned file (carol downloading an encrypted archive), and one audit event
(bob pasting into ChatGPT). The agent should summarize patterns — alice has
repeat block violations on sensitive uploads, the encrypted archive could not be
scanned, and the GenAI paste was audit-only.`,
  judgeInstructions: `The agent must report the events and provide some level of summary or
observation beyond a raw list. Acceptable synthesis includes: grouping by user
or event type, noting repeat violations, flagging the unscanned file, or
recommending follow-up actions. A response that merely lists timestamps and
event names with no commentary is a FAIL, but any reasonable attempt at
summarization should PASS.`,
}
