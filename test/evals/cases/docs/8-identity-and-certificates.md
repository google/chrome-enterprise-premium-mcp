--- CASE ---

id: k24
category: knowledge
tags:
  - okta
  - device-trust
priority: P2

## Prompt

We set up the Device Trust Connector with Okta, but Okta says the device is
unmanaged. Where is the signal breaking?

## Golden Response

Device trust signals flow from Chrome through Chrome Enterprise Core to
the Device Trust Connector and then to Okta. When Okta reports a device as
unmanaged, check Google's side first (is the device enrolled in Chrome Enterprise Core and
reporting to the Admin Console?) and then Okta's side (are attribute mappings
and trust rules correctly configured?). On BYOD devices, the user may need to
consent to device signal collection.

--- CASE ---

id: k25
category: knowledge
tags:
  - cba
  - certificates
required_patterns:
  - AutoSelectCertificateForUrls
priority: P1

## Prompt

We deployed certificates to the Windows key store, but Google isn't recognizing them during CBA login. Why?

## Golden Response

For Certificate-Based Access (CBA) to function correctly:

1. Ensure the Root CA certificate for your client certificates is uploaded to the Google Admin Console.
2. Configure the Chrome policy '[AutoSelectCertificateForUrls](https://chromeenterprise.google/policies/#AutoSelectCertificateForUrls)' to instruct Chrome to automatically present the certificate to Google's authentication URLs.
