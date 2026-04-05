---
title: 'Context-Aware Access (CAA) and Security Gateway'
kind: curated
articleType: curated-guide
articleId: 7
---

# Context-Aware Access and Security Gateway

Chrome Enterprise Premium (CEP) provides advanced access protection for both cloud resources and private web applications.

## Security Gateway Troubleshooting

### 401 Unauthorized Errors

A 401 Unauthorized error at the IAP Gateway indicates access was denied based on identity, device posture, or Context-Aware Access (CAA) rules.

## Extending Access to Native Applications

EV context is browser-specific. Native apps (IMAP/EWS) lack this context. To secure them, use Certificate-Based Access (CBA) or ZTNA agents.

If your Jamf BeyondCorp integration works for Chrome, but doesn't stop unmanaged devices from syncing the native macOS Calendar app, remember that native apps like Calendar (CalDAV) don't natively present device context. You must restrict API access using certificates or IdP device trust.

## Device Trust Connector (Okta) Troubleshooting

To troubleshoot the Device Trust Connector with Okta for unmanaged devices:

1. **User Consent:** On unmanaged devices, user consent is required for the Device Trust Connector to share information from the Managed Chrome Profile.
2. **Managed Profile Enrollment:** The user must be successfully signed into a Managed Chrome Profile linked to your organization.
3. **Verify Admin Console Configuration:** Navigate to the Connectors page in the Google Admin Console and ensure the "URL patterns to allow" and "Service accounts" match exactly what Okta provided.
4. **Check Chrome Policy:** Instruct the user to navigate to `chrome://policy` and verify that the `BrowserContextAwareAccessSignalsAllowlist` matches the URL patterns configured in the Admin Console.
5. **Inspect Connectors Internals:** Have the user navigate to `chrome://connectors-internals`. A correctly functioning connector should show `Is Enabled: true` and `Key Sync: Success (200)`.
6. **"Chicken-and-Egg" Mitigation:** If Okta policies require Device Trust signals _before_ allowing a user to sign into their Google Workspace account, new users on unmanaged devices might be blocked. You might need to temporarily adjust policies to allow initial profile sign-in without requiring Device Trust signals.
