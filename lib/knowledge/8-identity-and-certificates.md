---
title: 'Identity Provider (IdP) Integration and Certificates'
kind: curated
articleType: curated-guide
articleId: 8
---

# Identity and Certificate-Based Access

Chrome Enterprise Premium (CEP) supports advanced identity integrations and Certificate-Based Access (CBA) to enhance security.

## Identity Provider (IdP) Integration

When troubleshooting the Device Trust Connector with Okta for unmanaged devices, you should check Google's side for management status and Okta's side for attribute mappings. The agent cannot inspect third-party IdP integrations directly.

## Certificate-Based Access (CBA)

If you deployed certificates to the Windows key store, but Google isn't recognizing them during CBA login, ensure the Root CA is in the Workspace Console and the 'AutoSelectCertificateForUrls' policy is set.
