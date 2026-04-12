---
id: k24
category: knowledge
tags:
  - okta
  - device-trust
expected_tools:
  - search_content
priority: P2
---

## Prompt

We set up the Device Trust Connector with Okta, but Okta says the device is
unmanaged. Where is the signal breaking?

## Golden Response

Device trust signals flow from Chrome through Chrome Browser Cloud Management to
the Device Trust Connector and then to Okta. When Okta reports a device as
unmanaged, check Google's side first (is the device enrolled in CBCM and
reporting to the Admin Console?) and then Okta's side (are attribute mappings
and trust rules correctly configured?). On BYOD devices, the user may need to
consent to device signal collection.
