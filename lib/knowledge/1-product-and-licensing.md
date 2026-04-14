---
summary: 'Covers Chrome Enterprise Premium pricing, licensing assignment, free trial terms, required administrator roles, and troubleshooting setup or provisioning errors.'
title: 'Chrome Enterprise Premium Product & Licensing Overview'
articleId: 1
---

# Chrome Enterprise Premium: Product, Pricing, and Licensing

Chrome Enterprise Premium (CEP) is an advanced security solution enabling Zero Trust access to corporate applications without a traditional VPN. Its core capabilities include **Data Loss Prevention (DLP)**, **real-time malware and phishing scanning**, and **Context-Aware Access (CAA)**.
Standard Chrome offers robust security (e.g., sandboxing). The free Chrome Enterprise Core adds central policy management. Chrome Enterprise Premium provides advanced security layers on top of that, including Data Loss Prevention (DLP) and Context-Aware Access (CAA), for organizations with high security or regulatory needs.

## Core Capabilities

The standard Chrome browser has strong built-in security (Safe Browsing, sandboxing). Chrome Enterprise Core (free) allows enforcing over 300 policies. Chrome Enterprise Premium adds _advanced_ enterprise-grade security layers like deep content inspection, DLP, and Context-Aware Access controls for highly regulated environments. Core capabilities include Data Loss Prevention (DLP), real-time URL and file scanning for malware/phishing, and context-aware access controls for web applications.

## Pricing and Purchasing

- **List Price:** The standard list price for Chrome Enterprise Premium is $6 USD per user, per month.
- **Payment Methods:**
  - Credit card payments are supported via a self-service option in the Google Cloud Console.
  - **Traditional offline invoicing** (for enterprise customers).
- **Permissions (IAM Roles):** To purchase or manage CEP in the Google Cloud Console, a user needs specific Google Cloud IAM roles, as Google Workspace roles like Super Admin are not sufficient. The required roles, such as **'Cloud BeyondCorp Admin'** and **'Cloud BeyondCorp Subscription Admin'**, must be granted at the **Google Cloud Organization level**.
- **Admin Roles:** For managing specific features, use the **Security Center Admin** for viewing dashboards and security telemetry, and the **BeyondCorp Admin** for managing Context-Aware Access (CAA) policies.

## Free Trial

- **Activation:** You can start a 60-day trial (up to 5,000 users) from the Google Workspace Admin console or Google Cloud Console.
- **Expiration:** A CEP trial lasts **60 days** for up to **5,000 users**. When the trial expires, you are **not automatically charged**. Premium features will cease to function, but all of your configuration settings are preserved, allowing for a seamless transition if you choose to purchase.

## License Management

- **Assignment:** Purchasing Chrome Enterprise Premium licenses **does not** automatically protect users. An administrator must **manually assign licenses** to specific users, groups, or OUs in the Google Admin Console. Users and administrators who configure settings both require a license to be assigned.
- **Auto-Assignment:** An automatic license assignment feature is available in the Google Workspace Admin Console, but it must be manually enabled by an administrator for the CEP subscription.
- **Troubleshooting Security Insights:** The 'Something went wrong' error when enabling Security Insights indicates a server-side provisioning issue. The most common causes are: 1) **License Propagation Delay:** It can take up to 24 hours. 2) **Missing IAM Roles:** The user needs specific administrator privileges: 'Manage Chrome DLP application insights settings', 'View Chrome DLP application insights settings', and 'Chrome Enterprise Security Services Settings'. 3) **Billing Account Link:** The Cloud billing account may not be properly linked to Workspace.

## Delegated Administration (IAM & Admin Roles)

To allow management without full Super Admin access, use custom administrative roles within the Google Workspace Admin Console. This follows the security principle of least privilege, ensuring the Helpdesk team has only the access they need to perform their duties. You can create a custom role that includes a specific combination of privileges.

- **Cloud BeyondCorp Admin:** Mandatory at the Google Cloud Organization level to purchase or manage CEP via the Cloud Console. Workspace Super Admins do not automatically inherit this GCP permission.
- **Security Center Admin:** For Viewing Dashboards: roles with 'Chrome Security Insights / View' permissions.
- **DLP Administrator:** For Managing DLP Rules: roles with 'DLP / Manage DLP rule' permissions.
- **BeyondCorp Admin:** If they also need to manage access policies for Context-Aware Access (CAA) web applications, you would add the BeyondCorp Admin privilege.
- **Mobile Admin:** Recommended for device inventory and viewing dashboards/inventory.
- **Helpdesk:** To view CEP security dashboards without making changes, Helpdesk team members need the **"Chrome Enterprise Security Services"** Workspace Admin privilege AND the **`roles/beyondcorp.viewer`** Google Cloud IAM role.
  members need the **"Chrome Enterprise Security Services"** Workspace Admin privilege AND the **`roles/beyondcorp.viewer`** Google Cloud IAM role.
