---
id: k32
category: knowledge
tags:
  - jamf
  - native-apps
priority: P2
---

## Prompt

Our Jamf BeyondCorp integration works for Chrome, but doesn't stop unmanaged devices from syncing the native macOS Calendar app.

## Golden Response

Native apps like Calendar (CalDAV) don't natively present device context. You must restrict API access using certificates or IdP device trust.
