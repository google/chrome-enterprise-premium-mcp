---
id: k12
category: knowledge
tags:
  - ev
  - macos
required_patterns:
  - Sync Now
priority: P2
---

## Prompt

After a user updates macOS, EV doesn't report the new OS immediately, blocking their access. Can we trigger a sync programmatically?

## Golden Response

No native API exists to trigger this sync via MDM post-update. The user must manually click 'Sync Now' in the EV extension toolbar to push the new OS version to the access engine.
