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
  - GitHubDesktopSetup-x64.exe
priority: P1
fixtures:
  - dlp-activities.json
---

## Prompt

Have there been any recent data transfer violations or unscanned files?

## Golden Response

Yes, there was a CONTENT_UNSCANNED event for file 'GitHubDesktopSetup-x64.exe' downloaded by tim@cep-netnew.cc.
