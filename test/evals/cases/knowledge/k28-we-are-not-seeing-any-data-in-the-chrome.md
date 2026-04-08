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

We are not seeing any data in the Chrome security event dashboard. What should we check locally?

## Golden Response

On the client device, check `chrome://safe-browsing/#tab-reporting` to see if Safe Browsing events are being generated. Also, in the Google Admin Console, ensure that 'Event reporting' is enabled under Chrome Browser > Settings > Browser reporting, and confirm the users have Chrome Enterprise Premium licenses assigned and the reporting connector is configured if sending to a SIEM.

## Judge Instructions

The user specifically asks "What should we check locally?". Therefore, the primary requirement for a PASS is that the agent mentions checking `chrome://safe-browsing/#tab-reporting` on the user's device. Any additional server-side troubleshooting steps the agent provides (such as checking DLP logs, licensing, connector policies, or Admin Console settings) are acceptable and should NOT result in a FAIL. It is also acceptable for the agent to use phrases like "listing your DLP rules" without penalization unless it outputs the exact string `list_dlp_rules`.
