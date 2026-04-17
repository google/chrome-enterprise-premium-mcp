--- CASE ---

id: k08
category: knowledge
tags:
  - deployment
priority: P1

## Prompt

How do I deploy the Chrome browser for my organization?

## Golden Response

Download the Chrome Enterprise bundle (MSI, PKG, and policy templates). Deploy via SCCM, Intune, or other MDM tools, and sync management to the cloud via Chrome Enterprise Core.

--- CASE ---

id: k09
category: knowledge
tags:
  - deployment
  - ev
  - mdm
required_patterns:
  - ExtensionInstallForcelist
priority: P1

## Prompt

What is the best practice for silently deploying Endpoint Verification to all endpoints using an MDM like Intune?

## Golden Response

The best practice involves two main steps:

1. Use your MDM to push the Endpoint Verification extension (ID: `callobklhcbilhphinckomhgkigmfocg`) as a force-installed extension using the `ExtensionInstallForcelist` policy.
2. Deploy the Endpoint Verification Native Helper application (MSI for Windows, PKG for macOS) as a required application via your MDM.
   Both components are necessary for Endpoint Verification to function. More details on EV deployment can be found under 'Deploying the Endpoint Verification native helper'.

--- CASE ---

id: k33
category: knowledge
tags:
  - unenroll
priority: P1

## Prompt

How do we unenroll a device and remove Chrome Enterprise management policies?

## Golden Response

To unenroll a browser from Chrome Browser Cloud Management, you must remove the enrollment token from the device. This is located in the Windows Registry or as a file on macOS/Linux. You must then delete the device from the 'Managed browsers' list in the Google Admin Console to fully terminate management and free up the license. The process is described.
