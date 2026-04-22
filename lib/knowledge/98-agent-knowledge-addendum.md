---
summary: 'Mandatory Technical "Golden Facts" for Chrome Enterprise Premium. Helps with troubleshooting and precise configuration. Covers Extension IDs for EV and SEB, Windows Certificate Store requirements (Current User store mandatory), and the URL filtering syntax cheat-sheet. Keywords: callobklhcbilhphinckomhgkigmfocg, ekajlcmdfcigmdbphhifahdfjbkciflj, Windows Store requirements, Sync Now, SafeBrowsingAllowlistDomains.'
title: 'CEP Technical Addendum (Agent Memory)'
articleId: 98
---

# CEP Technical Addendum

This document contains mandatory technical facts and "Golden References" required for accurate administration of Chrome Enterprise Premium.

## 1. Extension & Policy Identifiers

- **Endpoint Verification (EV):**
  - **Extension ID:** `callobklhcbilhphinckomhgkigmfocg`
  - **Silent Deployment:** Must use the `ExtensionInstallForcelist` policy.
  - **Native Helper:** Required for all OS platforms to report security posture.
- **Secure Enterprise Browser (SEB):**
  - **Extension ID:** `ekajlcmdfcigmdbphhifahdfjbkciflj`
  - **Purpose:** Required for advanced DLP features like Data Masking.

## 2. Privacy & Data Collection

- **Privacy Statement:** Endpoint Verification **DOES NOT** collect personal data such as browsing history, user keystrokes, or the content of personal files. It only collects device posture (OS version, encryption status, etc.) and Workspace identity.

## 3. Policy Precedence & Compliance

- **Incognito Mode:** By default, security extensions and managed browser rules **DO NOT** run in Incognito mode. Administrators must force-enable them via `ExtensionSettings` or block Incognito access via Context-Aware Access (CAA) at sign-in.
- **Native Applications:** Standard CAA/DLP policies enforced in Chrome **DO NOT** apply to native apps (e.g., Apple Mail, Outlook). Protecting native apps requires **Certificate-Based Access (CBA)** or a **ZTNA agent**.

## 4. Certificate-Based Access (CBA) Mandatory Setup

To successfully implement CBA, you **MUST** complete all three steps:

1.  **Root CA Upload:** Upload the Root CA to **Devices > Networks > Certificates** and check "Enabled for Endpoint Verification."
2.  **Auto-Selection:** Configure the `AutoSelectCertificateForUrls` policy so users aren't prompted to choose a cert.
3.  **Windows Store:** Certificates **MUST** be in the **Current User** store. The Local Machine store is not supported.

## 5. URL Filtering Syntax Cheat-Sheet

- **`example.com`**: Matches `example.com` and **all its subdomains** (e.g., `test.example.com`).
- **`.example.com`**: Matches **ONLY** the specific host `example.com`. It disables subdomain matching.
- **`*`**: Wildcard for all hostnames and IP addresses.

## 6. Purchase, Trials, and Roles

- **Purchase:** Requires the `Cloud BeyondCorp Subscription Admin` role at the **Organization level**.
- **Trial Terms:** Trials are 60 days for 5,000 users. **CRITICAL:** All configuration settings are **SAVED** and preserved after the trial expires.
- **Security Insights Error:** If enabling fails with "Something went wrong," you **MUST** verify:
  - **Privileges**: `Chrome DLP insight setting management`, `Chrome Manage User Settings`, and `Chrome Security Services`.
  - **Billing**: Workspace instance must be linked to a valid Google Cloud billing account.
  - **Latency**: Allow 24 hours for license and privilege propagation.

## 7. DLP Rule Troubleshooting

- **Server-Side:** Use the **Investigation Tool** with the **Rule log events** data source.
- **Client-Side:** Direct users to `chrome://policy` to verify rule receipt.
- **SIEM:** Streaming events require the **Chrome Reporting Connector** and OU-level **Event Reporting** policy enablement.
