---
summary: 'Mandatory Technical "Golden Facts" and operational memory for Chrome Enterprise Premium. Covers Extension IDs for EV and SEB, Windows Certificate Store requirements for CBA, URL filtering syntax rules, and troubleshooting "Something went wrong" errors for Security Insights using specific privileges. Keywords: callobklhcbilhphinckomhgkigmfocg, ekajlcmdfcigmdbphhifahdfjbkciflj, Windows Store requirements, Security Insights Error, Chrome DLP insight setting management, SafeBrowsingAllowlistDomains.'
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

## 8. Chrome Security Insights (1-Click Flow)

The "Monitor data leaks and insider risk" 1-click flow provides visibility into insider risk and data exfiltration with a single action.

- **Automation:** It automatically enables **Chrome Enterprise Connectors**, **Chrome Security event logging**, and activates **50 common DLP detectors** to scan for sensitive content transfer events across Chrome.
- **Visibility:** Provides visibility into all file transfers, sensitive data detection, and security events.
- **Insights Reports:** Generates the following specific reports in the **Security Center** (Workspace Admin Console):
  - **Users with high content transfer**
  - **Domains with high content transfer**
  - **Domain categories with high content transfer**
  - **Most common sensitive data types**
- **Dashboard vs. Connector Isolation:** Activating connectors (like `ON_SECURITY_EVENT`) and DLP rules does **not** automatically enable the "Security Insights" dashboard, nor is it a guarantee of its state. Only the explicit activation of the Security Insights feature (such as the 1-click flow) will populate the Security Insights dashboard. Never assume "Security Insights" is active solely based on the presence of active connectors or rules.
