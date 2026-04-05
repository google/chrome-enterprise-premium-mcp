---
title: 'Chrome Enterprise Premium AI Agent Capabilities and Limitations'
kind: curated
articleType: curated-guide
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
- **Extension Status:** Check if the Secure Enterprise Browser (SEB) extension is force-installed for an OU.
- **API Status:** Check if required Google Cloud APIs are enabled for a project using the `get_api_status` tool.
- **URL Filtering:** Check active URL filtering policies using the `list_url_filtering_policies` tool.

### Configuration & Remediation (Mutations)

The agent can actively configure settings to remediate issues or set up new protections:

- **Enable APIs:** Check for required Google Cloud APIs (like Admin SDK, Cloud Identity) and enable them if missing.
- **Enable Connectors:** Turn on Chrome Enterprise Connectors (Print, Bulk Text Entry, File Download/Upload, Real-time URL Check) for an OU.
- **Deploy Extensions:** Force-install the Secure Enterprise Browser (SEB) extension for an OU.
- **Create DLP Rules & Detectors:** The agent can author and deploy new DLP rules, Regex detectors, Word lists, and URL lists. (See limitations below).
- **Starter Packs:** Deploy a default set of DLP rules as a "starter pack" for organizations new to CEP.

## Diagnostic Flows and Tool Mapping

The agent can help you troubleshoot and configure your environment by mapping your requests to specific diagnostic tools:

### 1. Subscription and Licensing

- **Verification:** I can check your current subscription and license assignment status using the **`check_cep_subscription`** and **`check_user_cep_license`** tools.
- **Trial Terms:** Standard CEP trials are **60 days for up to 5,000 users**. If your trial has expired, I can verify the impact on your environment.

### 2. Policy and Rule Auditing

- **Organizational Structure:** To see how your policies are applied, I can list your Organizational Units (OUs) using the **`list_org_units`** tool.
- **DLP Rule Discovery:** I can list your active Data Loss Prevention (DLP) rules using the **`list_dlp_rules`** tool.
- **Connector Verification:** I can verify if your **`ON_FILE_ATTACHED`**, **`ON_SECURITY_EVENT`**, or other connector policies are active for a specific OU using the **`get_connector_policy`** tool.

### 3. Endpoint and Browser Health

- **Chrome Versions:** I can audit the browser versions deployed across your organization using the **`count_browser_versions`** tool.
- **Extension Status:** I can verify if the Secure Enterprise Browser (SEB) extension is force-installed for an OU using the **`check_seb_extension_status`** tool.
- **Activity Monitoring:** I can retrieve the last 10 days of browser activity logs for a specific user using the **`get_chrome_activity_log`** tool.

### 4. Configuration and Remediation

- **Enabling Protections:** If a security feature is missing, I can enable it using the **`enable_chrome_enterprise_connectors`** or **`install_seb_extension`** tools.
- **Authoring Rules:** I can help you create new DLP rules, Regex detectors, and URL lists using the **`create_chrome_dlp_rule`**, **`create_regex_detector`**, and **`create_url_list_detector`** tools.

## What the Agent CANNOT Do (Limitations)

...
For security and architectural reasons, the agent has explicit limitations:

### 1. DLP Rule Enforcement Limits

- **No Active Block Rules:** To prevent accidental business disruption, the agent **cannot create an 'ACTIVE' DLP rule with a 'BLOCK' action**. It can only create 'INACTIVE' Block rules (which an admin must manually enable in the UI) or 'ACTIVE' rules set to 'WARN' or 'AUDIT'.
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
