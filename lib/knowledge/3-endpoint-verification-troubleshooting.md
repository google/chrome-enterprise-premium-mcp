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

A 'Failed to sync' error on the Endpoint Verification extension is typically an OS-level issue. Common causes to investigate are: 1) The EV Native Helper application is missing or not running. 2) EDR/Antivirus software is blocking the Native Helper. 3) The OS credential store is corrupt (macOS Keychain or Windows DPAPI). 4) A firewall is blocking connections to \*.google.com.

### 2. "Native messaging host not found"

The error **'Specified native messaging host not found'** means the Endpoint Verification Chrome extension cannot find or communicate with the required **Native Helper application** on the local machine. This is usually because the helper is missing, its installation is corrupt, or it's being blocked. The primary solution is to **reinstall the standalone Native Helper application**.

## Manual Sync and OS Update Delays

Endpoint Verification does not always report macOS/ChromeOS updates immediately. There is no server-side trigger to force this sync.

- **Manual Workaround:** There is no API or MDM command to programmatically trigger an Endpoint Verification (EV) sync after an OS update. If a reporting delay occurs, the user must manually click the **'Sync Now'** button in the EV extension's toolbar to force an immediate update of their device posture.
- **Requirement:** This is necessary to immediately push the new OS posture to the access engine and avoid access denial from Context-Aware Access policies. It may take up to 5 minutes after syncing for the access to be fully restored.

## Data Collection and Privacy

Endpoint Verification (EV) collects device posture information including OS version, serial number, MAC address, disk encryption status, screen lock state, and the signed-in Workspace identity. Crucially, EV **does not** collect personal data like browsing history, the contents of files, or user keystrokes.

## Support for BYOD and Incognito Mode

- **BYOD:** CEP secures BYOD devices by enforcing policies within a **Managed Chrome Profile**. If a user signs into this profile on an unmanaged device, CEP can detect compliance issues and block access to corporate applications, containing risk within the managed browser session.
- **Incognito Mode:** By default, CEP features relying on extensions (like Endpoint Verification) do not work in Incognito mode. Administrators have two primary options: **1) Force-enable** required extensions in Incognito mode via policy. **2) Block access** to corporate resources entirely if the user is in Incognito mode, using a Context-Aware Access (CAA) rule.
