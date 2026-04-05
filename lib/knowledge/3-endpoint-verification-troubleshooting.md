---
title: 'Endpoint Verification Troubleshooting and Data Usage'
kind: curated
articleType: curated-guide
articleId: 3
---

# Endpoint Verification Troubleshooting

Endpoint Verification (EV) provides device security posture to Context-Aware Access policies. Issues with sync or communication can lead to access denial.

## Common Sync Issues

### 1. "Failed to sync"

The issue is usually OS-level. Check for: 1) Missing EV Native Helper. 2) EDR/Antivirus blocking the Native Helper. 3) Corrupted macOS Keychain or Windows DPAPI. 4) Firewalls blocking `*.google.com`.

### 2. "Native messaging host not found"

If EV logs show "Specified native messaging host not found for com.google.endpoint_verification.api_helper", the Chrome extension cannot communicate with the Native Helper component. It is either missing, the registry keys/plist files are corrupted, or execution permissions are denied. Reinstalling the standalone Native Helper is the primary fix.

## Manual Sync and OS Update Delays

Endpoint Verification does not always report macOS/ChromeOS updates immediately. There is no server-side trigger to force this sync.

- **Manual Workaround:** Users must click the **Sync Now** button in the Endpoint Verification extension toolbar. Alternatively, they can restart Chrome (`chrome://restart`).
- **Requirement:** This is necessary to immediately push the new OS posture to the access engine and avoid access denial from Context-Aware Access policies. It may take up to 5 minutes after syncing for the access to be fully restored.

## Data Collection and Privacy

The Endpoint Verification extension collects the following device posture information: OS version, serial number, MAC address, disk encryption status, screen lock, and the signed-in Workspace identity. It does _not_ collect browsing history, personal files, or keystrokes.

## Support for BYOD and Incognito Mode

- **BYOD:** CEP can help manage risks when employees use personal (BYOD) devices. It enforces policies when users sign into a managed Chrome Profile. It detects if security settings are overridden and can block access to corporate apps if the device fails compliance.
- **Incognito Mode:** By default, extensions are disabled in Incognito. Admins must use policies like 'ExtensionAllowedTypes' or force-enabling specific extensions to ensure EV and DLP remain active.
