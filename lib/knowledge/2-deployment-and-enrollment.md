---
title: 'Chrome Browser Deployment and Enrollment'
kind: curated
articleType: curated-guide
articleId: 2
---

# Deploying and Managing Chrome Enterprise

Deploying Chrome Enterprise across an organization involves managing both the browser and its security posture through Cloud Management.

## Browser Deployment

Download the Chrome Enterprise bundle (MSI, PKG, and policy templates). Deploy via SCCM, Intune, or other MDM tools, and sync management to the cloud via Chrome Enterprise Core.

## Enrollment Tokens

Browsers become managed when an enrollment token is successfully applied to the client device.

### Enrollment Token Locations

- **Windows:** Registry key `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\CloudManagementEnrollmentToken`.
- **macOS:** Configuration profiles (`.mobileconfig`) containing the `CloudManagementEnrollmentToken`.

## Deployment of Endpoint Verification

Endpoint Verification (EV) is required to report device security posture to Context-Aware Access policies. For a successful silent deployment via MDM (like Intune):

1.  Use an MDM Configuration Profile to set the 'ExtensionInstallForcelist' policy for the EV extension.
2.  Deploy the standalone EV Native Helper installer (MSI/PKG) as a required app. Both are mandatory.

## Unenrollment

To unenroll a device and remove Chrome Enterprise management policies:

1.  **Client-side:** Delete the enrollment token from the Registry (Windows) or remove the profile (macOS).
2.  **Server-side:** **Mandatory Final Step:** You must manually delete the device from the Google Admin Console to fully terminate management and free up the license.
