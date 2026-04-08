---
id: k30
category: knowledge
tags:
  - dlp
  - troubleshooting
expected_tools:
  - search_content
required_patterns:
  - 'chrome://safe-browsing'
---

## Prompt

Support asked for logs regarding a DLP rule that isn't triggering. Which logs are needed?

## Golden Response

For troubleshooting DLP rules:

- **Client-side:** Ask the user to check `chrome://safe-browsing/#tab-reporting` to see if any relevant events are listed locally.
- **Server-side:** Check the 'Chrome log events' in the Google Admin Console under Reporting > Audit and investigation. Filter by the user, time range, and event type (e.g., 'Data Loss Prevention'). Ensure the user is licensed and the rule is correctly scoped to their OU or group.
