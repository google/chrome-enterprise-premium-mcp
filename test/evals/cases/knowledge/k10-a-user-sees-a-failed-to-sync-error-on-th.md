---
id: k10
category: knowledge
tags:
  - ev
  - troubleshooting
expected_tools:
  - search_content
required_patterns: []
priority: P1
---

## Prompt

A user sees a 'Failed to sync' error on the EV extension. We reinstalled the extension but it didn't help. Fixes?

## Golden Response

The issue is usually OS-level. Check for: 1) Missing EV Native Helper. 2) EDR/Antivirus blocking the Native Helper. 3) Corrupted macOS Keychain or Windows DPAPI. 4) Firewalls blocking `*.google.com`.
