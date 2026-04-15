---
summary: 'Covers Identity Provider (IdP) integration and Certificate-Based Access (CBA). Explains requirements for Root CA deployment and configuring AutoSelectCertificateForUrls for seamless authentication.'
title: 'Identity Provider (IdP) Integration and Certificates'
articleId: 8
---

# Identity and Certificate-Based Access

Chrome Enterprise Premium (CEP) supports advanced identity integrations and Certificate-Based Access (CBA) to enhance security.

## Identity Provider (IdP) Integration

When troubleshooting the [Device Trust Connector](7-context-aware-access.md) with Okta for unmanaged devices, you should check Google's side for management status and Okta's side for attribute mappings. The agent cannot inspect third-party IdP integrations directly.

## Certificate-Based Access (CBA)

If Certificate-Based Access (CBA) is failing, verify two critical settings: **1) Root CA Certificate:** Ensure the appropriate Root CA certificate has been uploaded to the Google Admin Console under **Devices > Chrome > Settings > Users & browsers**. **2) Auto-Select Policy:** Configure the **AutoSelectCertificateForUrls** policy to instruct Chrome to automatically present the correct client certificate to Google's authentication URLs.
