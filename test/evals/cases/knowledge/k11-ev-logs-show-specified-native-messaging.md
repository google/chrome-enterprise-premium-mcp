---
id: k11
category: knowledge
tags:
  - ev
  - troubleshooting
expected_tools:
  - search_content
required_patterns: []
priority: P2
---

## Prompt

EV logs show "Specified native messaging host not found for com.google.endpoint_verification.api_helper". What does this mean?

## Golden Response

The Chrome extension cannot communicate with the Native Helper component. It is either missing, the registry keys/plist files are corrupted, or execution permissions are denied. Reinstalling the standalone Native Helper is the primary fix.
