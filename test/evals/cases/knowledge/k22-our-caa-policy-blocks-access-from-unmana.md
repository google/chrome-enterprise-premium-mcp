---
id: k22
category: knowledge
tags:
  - caa
  - native-apps
priority: P1
---

## Prompt

Our CAA policy blocks access from unmanaged devices in Chrome, but users can still use the native Apple Mail app on macOS. How do we fix this?

## Golden Response

EV context is browser-specific. Native apps (IMAP/EWS) lack this context. To secure them, use Certificate-Based Access (CBA) or ZTNA agents.
