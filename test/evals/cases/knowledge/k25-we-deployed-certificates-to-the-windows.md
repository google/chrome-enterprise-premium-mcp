---
id: k25
category: knowledge
tags:
  - cba
  - certificates
required_patterns:
  - AutoSelectCertificateForUrls
priority: P1
---

## Prompt

We deployed certificates to the Windows key store, but Google isn't recognizing them during CBA login. Why?

## Golden Response

For Certificate-Based Access (CBA) to function correctly:

1. Ensure the Root CA certificate for your client certificates is uploaded to the Google Admin Console.
2. Configure the Chrome policy '[AutoSelectCertificateForUrls](https://chromeenterprise.google/policies/#AutoSelectCertificateForUrls)' to instruct Chrome to automatically present the certificate to Google's authentication URLs.
