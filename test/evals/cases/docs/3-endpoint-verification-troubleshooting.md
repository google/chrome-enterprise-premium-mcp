--- CASE ---

id: k10
category: knowledge
tags:
  - ev
  - troubleshooting
required_patterns: []
priority: P1

## Prompt

A user sees a 'Failed to sync' error on the EV extension. We reinstalled the extension but it didn't help. Fixes?

## Golden Response

The issue is usually OS-level. Check for: 1) Missing EV Native Helper. 2) EDR/Antivirus blocking the Native Helper. 3) Corrupted macOS Keychain or Windows DPAPI. 4) Firewalls blocking `*.google.com`.

--- CASE ---

id: k11
category: knowledge
tags:
  - ev
  - troubleshooting
required_patterns: []
priority: P2

## Prompt

EV logs show "Specified native messaging host not found for com.google.endpoint_verification.api_helper". What does this mean?

## Golden Response

The Chrome extension cannot communicate with the Native Helper component. It is either missing, the registry keys/plist files are corrupted, or execution permissions are denied. Reinstalling the standalone Native Helper is the primary fix.

--- CASE ---

id: k12
category: knowledge
tags:
  - ev
  - macos
required_patterns:
  - Sync Now
priority: P2

## Prompt

After a user updates macOS, EV doesn't report the new OS immediately, blocking their access. Can we trigger a sync programmatically?

## Golden Response

No native API exists to trigger this sync via MDM post-update. The user must manually click 'Sync Now' in the EV extension toolbar to push the new OS version to the access engine.

--- CASE ---

id: k13
category: knowledge
tags:
  - ev
  - privacy
priority: P2

## Prompt

What exact information does the Endpoint Verification extension collect from employee devices?

## Golden Response

Endpoint Verification collects device posture attributes such as OS type and version, device ID, serial number, screen lock status, disk encryption status, and more. It does _not_ collect personal browsing history or file contents. A comprehensive list of collected attributes is available in the [Device attributes collected by Endpoint Verification](https://cloud.google.com/endpoint-verification/docs/device-information) documentation.

## Judge Instructions

The agent must list the core attributes collected and explicitly state that personal data like browsing history is NOT collected. The agent is NOT required to provide the link to the documentation, as long as the core facts are accurate.

--- CASE ---

id: k15
category: knowledge
tags:
  - incognito
priority: P2

## Prompt

Do CEP security features and Endpoint Verification work when a user is in
Incognito mode?

## Golden Response

By default, extensions like Endpoint Verification are disabled in Incognito
mode. Administrators must use Chrome policies (e.g., force-enabling specific
extensions) to ensure EV and DLP protections remain active in Incognito.

--- CASE ---

id: k32
category: knowledge
tags:
  - jamf
  - native-apps
priority: P2

## Prompt

Our Jamf BeyondCorp integration works for Chrome, but doesn't stop unmanaged devices from syncing the native macOS Calendar app.

## Golden Response

Native apps like Calendar (CalDAV) don't natively present device context. You must restrict API access using certificates or IdP device trust.
