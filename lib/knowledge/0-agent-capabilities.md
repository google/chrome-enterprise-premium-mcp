---
summary: 'Comprehensive guide to agent capabilities and strict security boundaries. Covers diagnostic checks (licenses, logs, versions), remediation actions (enabling APIs/Connectors), and explicit limitations (no active BLOCK rules, no human-rule deletion, no Evidence Locker access).'
title: 'Chrome Enterprise Premium AI Agent Capabilities and Limitations'
articleId: 0
---

# AI Agent Capabilities and Limitations

This document outlines what the Chrome Enterprise Premium AI Agent can and cannot do on behalf of administrators. The agent is integrated with the Google Workspace environment via the Model Context Protocol (MCP), granting it specific read and mutation capabilities.

## What the Agent CAN Do (Capabilities)

### Diagnostics & Information Retrieval

The agent can query your environment to help diagnose issues:

- **License & Subscription Checks:** Verify if your organization has an active [Chrome Enterprise Premium subscription](1-product-and-licensing.md) and check if specific users have been assigned a license.
- **Policy Verification:** When auditing or checking if "correct" connectors are in place, the agent must verify all 6 connectors: **FILE_UPLOAD** (`ON_FILE_ATTACHED`), **FILE_DOWNLOAD** (`ON_FILE_DOWNLOAD`), **BULK_TEXT_ENTRY** (`ON_BULK_TEXT_ENTRY`), **PRINT** (`ON_PRINT`), **REALTIME_URL_CHECK** (`ON_REALTIME_URL_NAVIGATION`), and **ON_SECURITY_EVENT**. By default, these checks must be performed against the **root Organizational Unit (OU)** unless a specific OU is requested. For each connector, the agent must follow a mandatory sequence: first retrieve the current configuration for all 6 connectors, then provide a comprehensive summary of all findings to the user. ONLY after presenting this summary and identifying which connectors are 'Not configured' or 'not enabled' should the agent ask for explicit permission to enable them. If the retrieval output contains any warnings, the agent must present the specific manual Admin Console links provided in the warning text as part of the summary. During this specific audit, focus strictly on technical configuration (Provider, Status, Delay Delivery) and do NOT check for the Secure Enterprise Browser (SEB) extension or active DLP rules unless explicitly requested.
- **Log Analysis:** Retrieve the last 10 days of [Chrome activity logs](9-siem-and-event-reporting.md) for a user, including device sync events and security flags.
- **Environment Discovery:** List Organizational Units (OUs), active [Data Loss Prevention (DLP) rules](4-dlp-core-features.md), and DLP content detectors (Regex, Word lists, URL lists).
- **Health Checks:** The agent can perform a 'health check' of a CEP deployment by combining discovery tools to report on **subscription status**, **OU structure**, **browser version distribution**, and active **DLP rules**, then provide a summary assessment.
- **License Assignment Status:** The agent can check the specific Chrome Enterprise Premium license assignment status for one or more individual users when provided with their email addresses.
- **Version Audits:** The agent can audit all deployed Chrome browser versions across an organization, providing a count of devices on each version and channel. It should also be able to **identify and flag versions that are older than the current stable release** as 'outdated'.
- **Customer & OU Structure:** The agent is capable of discovering environment details on command, such as retrieving the **Customer ID** and listing the full **Organizational Unit (OU) structure**, including parent-child relationships.
- **Content Detectors:** The agent can discover and list all custom **DLP content detectors** configured in the environment. For each detector, it can provide the name, type, and the specific content it is configured to detect.
- **Extension Status:** Check if the [Secure Enterprise Browser (SEB) extension](2-deployment-and-enrollment.md) is force-installed for an OU.
- **API Status:** Check if required Google Cloud APIs (Admin SDK, Chrome Management, Chrome Policy, Cloud Identity, and Licensing) are enabled for a project. Note that the **Service Usage API** (`serviceusage.googleapis.com`) is also required if any of these five APIs are missing.
- **URL Filtering:** Check active [URL filtering policies](10-policy-and-url-filtering.md).

### Configuration & Remediation (Mutations)

The agent can actively configure settings to remediate issues or set up new protections:

- **Enable APIs:** Check for required Google Cloud APIs (Admin SDK, Chrome Management, Chrome Policy, Cloud Identity, and Licensing) and enable them if missing. The **Service Usage API** (`serviceusage.googleapis.com`) cannot be enabled by the tool and requires manual enablement via the [Google Cloud Console](https://console.cloud.google.com/apis/library/serviceusage.googleapis.com). It is only required if any of the other five core APIs are missing and need to be enabled.
- **Enable Connectors:** Turn on Chrome Enterprise Connectors (Print, Bulk Text Entry, File Download/Upload, Real-time URL Check) for an OU.
- **Deploy Extensions:** Force-install the Secure Enterprise Browser (SEB) extension for an OU.
- **Create DLP Rules & Detectors:** The agent can author and deploy new DLP rules, Regex detectors, Word lists, and URL lists. (See limitations below).
- **Starter Packs:** Deploy a default set of DLP rules as a "starter pack" for organizations new to CEP.

## Diagnostic Flows

The agent maps administrator requests to the appropriate diagnostic and configuration capabilities:

### 1. Subscription and Licensing

- **Verification:** Check the organization's subscription status and verify individual user license assignments.
- **Trial Terms:** Standard CEP trials are **60 days for up to 5,000 users**. If a trial has expired, the agent can verify the impact on the environment.

### 2. Policy and Rule Auditing

- **Organizational Structure:** List Organizational Units (OUs) to understand policy application.
- **DLP Rule Discovery:** List active Data Loss Prevention (DLP) rules and their configurations.
- **Connector Verification:** Verify if `ON_FILE_ATTACHED`, `ON_SECURITY_EVENT`, or other connector policies are active for a specific OU.

### 3. Endpoint and Browser Health

- **Chrome Versions:** Audit browser versions deployed across the organization.
- **Extension Status:** Verify if the Secure Enterprise Browser (SEB) extension is force-installed for an OU.
- **Activity Monitoring:** Retrieve the last 10 days of browser activity logs for a specific user.

### 4. Configuration and Remediation

- **Enabling Protections:** Enable Chrome Enterprise Connectors and force-install the SEB extension.
- **Authoring Rules:** Create new DLP rules, Regex detectors, Word lists, and URL lists.

## What the Agent CANNOT Do (Limitations)

...
For security and architectural reasons, the agent has explicit limitations:

### 1. DLP Rule Enforcement Limits

- **No Active Block Rules:** To prevent accidental business disruption, the agent **cannot create an 'ACTIVE' DLP rule with a 'BLOCK' action**. It can only create 'INACTIVE' Block rules (which an admin must manually enable in the UI) or 'ACTIVE' rules set to 'WARN' or 'AUDIT'. When confirming a successful action, the agent should not expose internal system identifiers like policy resource names or raw CEL code.
- **No Rule Deletion or Modification:** The agent cannot delete or modify existing DLP rules, including those it created itself. To disable or delete a rule, the agent can provide a direct link for an administrator to perform the action manually in the Admin Console.

### 2. Billing and Purchasing

- The agent cannot process payments or link billing accounts.
- **Pricing:** Standard list price is **$6/user/month**.
- **Payment:** Supports credit card self-service or **traditional offline invoicing**.
- **Trial:** The agent can help you start a **60-day free trial** for up to **5,000 users**.
- **Permissions (IAM Roles):** Management requires the **Cloud BeyondCorp Admin** role at the Organization level and the **Security Center Admin** role for dashboards/telemetry.

### 3. Client-Side Actions

- **No Remote Syncing:** The agent cannot remotely force a user's Endpoint Verification extension to sync. The user must manually click **"Sync Now"** in their browser.
- **Diagnostics:** The agent can guide users to the local client-side diagnostic page at **`chrome://safe-browsing/#tab-reporting`** to verify rule hits.
- **No Local OS Control:** The agent cannot modify Platform policies (e.g., Windows Registry, macOS Profiles) directly on end-user machines. It can only configure Cloud policies via the Admin Console.

### 4. Third-Party Integrations

- **IdP Connectors:** The agent cannot inspect third-party Identity Provider (IdP) integrations (like Okta) directly. It cannot check attribute mappings or sync status on the IdP side.

### 5. Data Privacy

- **Evidence Locker Content:** The agent cannot read or download the actual content of files stored in the Evidence Locker. It can only see the metadata logs indicating a file was flagged. An admin must manually download the password-protected ZIP from the Security Investigation Tool.
- **Unenrollment:** To fully unenroll a device, an admin must delete the enrollment token client-side and then **delete the device from the Admin Console**. The agent cannot perform the client-side deletion.
