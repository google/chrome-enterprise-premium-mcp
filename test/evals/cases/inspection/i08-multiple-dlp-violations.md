---
id: i08
category: inspection
tags:
  - dlp
  - activity
fixtures:
  - dlp-activities-multi.json
expected_tools:
  - get_chrome_activity_log
priority: P2
---

## Prompt

Review recent Chrome security events. Are there any DLP violations or content
scanning issues I should know about?

## Golden Response

Agent should report 5 events across 3 users: two blocks (alice uploading payroll
and SSN files to external sites), one warn (bob uploading a customer list), one
unscanned file (carol downloading an encrypted archive), and one audit event
(bob pasting into ChatGPT). The agent should summarize patterns — alice has
repeat block violations on sensitive uploads, the encrypted archive could not be
scanned, and the GenAI paste was audit-only.

## Judge Instructions

The agent must report the events and provide some level of summary or
observation beyond a raw list. Acceptable synthesis includes: grouping by user
or event type, noting repeat violations, flagging the unscanned file, or
recommending follow-up actions. A response that merely lists timestamps and
event names with no commentary is a FAIL, but any reasonable attempt at
summarization should PASS.
