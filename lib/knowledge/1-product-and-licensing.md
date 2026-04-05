---
title: 'Chrome Enterprise Premium Product & Licensing Overview'
kind: curated
articleType: curated-guide
articleId: 1
---

# Chrome Enterprise Premium: Product, Pricing, and Licensing

Chrome Enterprise Premium (CEP) is an advanced security offering that builds upon the standard Chrome browser and Chrome Enterprise Core management. It enables secure, Zero Trust access to applications and resources without requiring a VPN.

## Core Capabilities

The standard Chrome browser has strong built-in security (Safe Browsing, sandboxing). Chrome Enterprise Core (free) allows enforcing over 300 policies. Chrome Enterprise Premium adds _advanced_ enterprise-grade security layers like deep content inspection, DLP, and Context-Aware Access controls for highly regulated environments. Core capabilities include Data Loss Prevention (DLP), real-time URL and file scanning for malware/phishing, and context-aware access controls for web applications.

## Pricing and Purchasing

- **List Price:** The standard list price is $6 USD per user, per month (volume discounts may apply).
- **Payment Methods:**
  - Credit card (self-service in Google Cloud Console).
  - **Traditional offline invoicing** (for enterprise customers).
- **Permissions (IAM Roles):** To purchase or manage CEP via the Cloud Console, your account needs the **Cloud BeyondCorp Admin** IAM role. This role must be explicitly granted at the Google Cloud _Organization_ level, not just on a specific Project. Workspace Super Admins do not automatically inherit this GCP permission. I can verify if the necessary APIs are enabled by checking your API status.
- **Admin Roles:** For managing specific features, use the **Security Center Admin** for viewing dashboards and security telemetry, and the **BeyondCorp Admin** for managing Context-Aware Access (CAA) policies.

## Free Trial

- **Activation:** You can start a 60-day trial (up to 5,000 users) from the Google Workspace Admin console or Google Cloud Console.
- **Expiration:** Upon expiration, you are not automatically charged. Premium features (custom DLP, CAA) immediately stop functioning, but your configuration settings are saved in case you purchase a subscription later.

## License Management

- **Assignment:** By default, Chrome Enterprise Premium licenses are **not automatically assigned** to users upon purchase or trial activation. An administrator must go into the Google Workspace Admin Console and manually assign the licenses to specific users, groups, or Organizational Units (OUs) to activate the premium protections.
- **Auto-Assignment:** An automatic license assignment feature is available in the Google Workspace Admin Console, but it must be manually enabled by an administrator for the CEP subscription. I can check your current subscription and license assignment status by checking your subscription status.
- **Troubleshooting Security Insights:** If you encounter a 'Something went wrong' error when enabling Security Insights, this is a provisioning synchronization issue caused by: 1) License propagation delays (can take up to 24 hours). 2) Missing IAM roles (**Security Center Admin** or **Cloud BeyondCorp Admin**). 3) The organization's Google Cloud billing account might not be properly linked to the Workspace instance.

## Delegated Administration (IAM & Admin Roles)

To allow management without full Super Admin access, use custom administrative roles within the Google Workspace Admin Console. This follows the security principle of least privilege, ensuring the Helpdesk team has only the access they need to perform their duties. You can create a custom role that includes a specific combination of privileges.

- **Cloud BeyondCorp Admin:** Mandatory at the Google Cloud Organization level to purchase or manage CEP via the Cloud Console. Workspace Super Admins do not automatically inherit this GCP permission.
- **Security Center Admin:** To view security dashboards and investigate events in the Security Center, assign the Security Center Admin privilege.
- **DLP Administrator:** To allow them to manage Data Loss Prevention rules, assign the DLP Administrator privilege.
- **BeyondCorp Admin:** If they also need to manage access policies for Context-Aware Access (CAA) web applications, you would add the BeyondCorp Admin privilege.
- **Mobile Admin:** Recommended for device inventory and viewing dashboards/inventory.
- **Helpdesk:** To view CEP security dashboards without making changes, Helpdesk team members need the **"Chrome Enterprise Security Services"** Workspace Admin privilege AND the **`roles/beyondcorp.viewer`** Google Cloud IAM role.
