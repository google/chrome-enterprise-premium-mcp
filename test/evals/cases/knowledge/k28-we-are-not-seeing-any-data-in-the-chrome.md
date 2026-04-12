---
id: k28
category: knowledge
tags:
  - troubleshooting
  - dashboard
expected_tools:
  - search_content
priority: P2
---

## Prompt

We are not seeing any data in the Chrome security event dashboard. What should
we check locally?

## Golden Response

On the client device, check `chrome://safe-browsing/#tab-reporting` to see if
Safe Browsing events are being generated. Also, in the Google Admin Console,
ensure that 'Event reporting' is enabled under Chrome Browser > Settings >
Browser reporting, and confirm the users have Chrome Enterprise Premium licenses
assigned and the reporting connector is configured if sending to a SIEM.

## Judge Instructions

The agent should suggest relevant client-side and server-side diagnostic steps.
Mentioning `chrome://safe-browsing/#tab-reporting` is a strong signal but not
the only valid approach — any reasonable troubleshooting guidance (checking
Admin Console reporting settings, verifying license assignment, confirming
connector configuration) should pass.
