---
id: k09
category: knowledge
tags:
  - deployment
  - ev
  - mdm
expected_tools:
  - search_content
required_patterns:
  - ExtensionInstallForcelist
priority: P1
---

## Prompt

What is the best practice for silently deploying Endpoint Verification to all endpoints using an MDM like Intune?

## Golden Response

The best practice involves two main steps:

1. Use your MDM to push the Endpoint Verification extension (ID: `callobklhcbilhphinckomhgkigmfocg`) as a force-installed extension using the `ExtensionInstallForcelist` policy.
2. Deploy the Endpoint Verification Native Helper application (MSI for Windows, PKG for macOS) as a required application via your MDM.
   Both components are necessary for Endpoint Verification to function. More details on EV deployment can be found under 'Deploying the Endpoint Verification native helper'.
