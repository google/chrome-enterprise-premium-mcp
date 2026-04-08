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

We set up the Device Trust Connector with Okta, but Okta says the device is unmanaged. Where is the signal breaking?

## Golden Response

To troubleshoot Device Trust Connector issues with Okta, follow these steps: 1) Verify the device is enrolled in Chrome Browser Cloud Management and reporting to the Admin Console. 2) Check chrome://policy to confirm the BeyondCorp connector policies are applied. 3) Inspect chrome://connectors-internals for real-time connector status. 4) In the Okta admin console, verify integration settings, attribute mappings, and trust rules. 5) If using unmanaged (BYOD) devices, confirm the user has consented to device signals collection. 6) Watch for the "Chicken-and-Egg" scenario where Okta requires Device Trust signals before allowing Workspace sign-in — this may require temporarily exempting Workspace from the trust policy.
