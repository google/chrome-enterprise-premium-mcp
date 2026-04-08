---
summary: 'Details the capabilities (diagnostics, remediation) and limitations (no active block rules, no client-side actions) of the Chrome Enterprise Premium AI Agent.'
title: 'Chrome Enterprise Premium AI Agent Capabilities and Limitations'
articleId: 0
---

# AI Agent Capabilities and Limitations

This document outlines what the Chrome Enterprise Premium AI Agent can and cannot do on behalf of administrators. The agent is integrated with the Google Workspace environment via the Model Context Protocol (MCP), granting it specific read and mutation capabilities.

## What the Agent CAN Do (Capabilities)

### Diagnostics & Information Retrieval

The agent can query your environment to help diagnose issues:

- **License & Subscription Checks:** Verify if your organization has an active Chrome Enterprise Premium subscription and check if specific users have been assigned a license.
- **Policy Verification:** Check Chrome Enterprise Connector policies (e.g., `ON_FILE_ATTACHED`, `ON_SECURITY_EVENT`) to ensure DLP rules and event reporting are correctly configured for an Organizational Unit (OU).
- **Log Analysis:** Retrieve the last 10 days of Chrome activity logs for a user, including device sync events and security flags.
- **Environment Discovery:** List Organizational Units (OUs), active Data Loss Prevention (DLP) rules, and DLP content detectors (Regex, Word lists, URL lists).
- **Health Checks:** The agent can perform a 'health check' of a CEP deployment by combining discovery tools to report on **subscription status**, **OU structure**, **browser version distribution**, and active **DLP rules**, then provide a summary assessment.
- **License Assignment Status:** The agent can check the specific Chrome Enterprise Premium license assignment status for one or more individual users when provided with their email addresses.
- **Version Audits:** The agent can audit all deployed Chrome browser versions across an organization, providing a count of devices on each version and channel. It should also be able to **identify and flag versions that are older than the current stable release** as 'outdated'.
- **Customer & OU Structure:** The agent is capable of discovering environment details on command, such as retrieving the **Customer ID** and listing the full **Organizational Unit (OU) structure**, including parent-child relationships.
- **Content Detectors:** The agent can discover and list all custom **DLP content detectors** configured in the environment. For each detector, it can provide the name, type, and the specific content it is configured to detect.
- **Extension Status:** Check if the Secure Enterprise Browser (SEB) extension is force-installed for an OU.
- **API Status:** Check if required Google Cloud APIs are enabled for a project.
- **URL Filtering:** Check active URL filtering policies.

### Configuration & Remediation (Mutations)

The agent can actively configure settings to remediate issues or set up new protections:

- **Enable APIs:** Check for required Google Cloud APIs (like Admin SDK, Cloud Identity) and enable them if missing.
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
- **Deletion Restrictions:** The agent can only delete DLP rules that it created itself (identified by a '🤖' prefix in the rule name). It **cannot delete human-created DLP rules**.

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
