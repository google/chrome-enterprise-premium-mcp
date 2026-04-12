---
id: i06
category: inspection
tags:
  - inspection
expected_tools:
  - get_chrome_activity_log
forbidden_patterns: []
required_patterns:
  - CONTENT_UNSCANNED
priority: P1
fixtures:
  - dlp-activities.json
---

## Prompt

Have there been any recent data transfer violations or unscanned files?

## Golden Response

Yes, there was a CONTENT_UNSCANNED event — a file download by tim@cep-netnew.cc
was not scanned by the DLP engine. This typically means the file was
password-protected, too large, or the download connector wasn't configured to
scan it.

## Judge Instructions

The agent must identify the CONTENT_UNSCANNED event and the associated user.
Mentioning the specific filename is a plus but not required — what matters is
that the agent reports the unscanned event and explains its significance.
