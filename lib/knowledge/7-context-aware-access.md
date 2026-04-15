---
summary: 'Guides troubleshooting for Context-Aware Access (CAA), Access Level definitions, Security Gateway errors, and securing native apps via Certificate-Based Access.'
title: 'Context-Aware Access (CAA) and Security Gateway'
articleId: 7
---

# Context-Aware Access and Security Gateway

Chrome Enterprise Premium (CEP) provides advanced access protection for both cloud resources and private web applications.

## Security Gateway Troubleshooting

### 401 Unauthorized Errors

A **'401 Unauthorized'** error from the BeyondCorp Security Gateway indicates that the user's request was denied by an **Identity-Aware Proxy (IAP)** policy. This is because the user or their device did not meet the conditions in your Context-Aware Access (CAA) rules. To troubleshoot, review the **IAP logs** and verify your **Access Level definitions** in the Google Cloud Console.

## Extending Access to Native Applications

Context-Aware Access (CAA) policies that use browser signals are not enforced on native applications like Mail or Calendar, as these apps do not send the required context. To secure these applications, you must use an alternative method like **Certificate-Based Access (CBA)**, which uses device certificates to grant access, or a **Zero Trust Network Access (ZTNA)** solution.

Integrations like Jamf and BeyondCorp that rely on browser signals will not secure native apps. Applications like the macOS Calendar use different protocols (e.g., CalDAV) that do not carry device context. To enforce security, you must restrict access at the API level using device certificates or by configuring your **Identity Provider (IdP)** to recognize device trust.

## Device Trust Connector (Okta) Troubleshooting

When troubleshooting a failing Device Trust integration with an [IdP like Okta](8-identity-and-certificates.md), verify the following:

1. **User Consent:** On unmanaged devices, user consent is required for the Device Trust Connector to share information from the Managed Chrome Profile.
2. **Managed Profile Enrollment:** The user must be signed into a Managed Chrome Profile linked to your organization.
3. **Check Okta's Side:** You must verify that attribute mappings and trust rules are correctly configured on the Okta side. The agent cannot inspect third-party IdP integrations directly.
4. **Admin Console Configuration:** Ensure the URL patterns and service accounts match exactly what the IdP provided. Verify that the **BrowserContextAwareAccessSignalsAllowlist** policy is correctly configured to include the IdP's URL patterns.
5. **Check Chrome Policy:** Have the user navigate to `chrome://policy` and verify that the allowlist matches the Admin Console configuration.
6. **Inspect Connectors Internals:** Have the user navigate to `chrome://connectors-internals`. A correctly functioning connector should show `Is Enabled: true` and `Key Sync: Success (200)`.
7. **"Chicken-and-Egg" Mitigation:** If IdP policies require Device Trust signals before allowing sign-in to Google Workspace, new users on unmanaged devices may be blocked. Temporarily adjust policies to allow initial profile sign-in without requiring Device Trust signals.
