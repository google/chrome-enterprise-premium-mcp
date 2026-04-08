---
summary: 'Provides instructions for deploying the Chrome browser and Endpoint Verification extension using MDM, as well as the steps for device unenrollment.'
title: 'Chrome Browser Deployment and Enrollment'
articleId: 2
---

# Deploying and Managing Chrome Enterprise

Deploying Chrome Enterprise across an organization involves managing both the browser and its security posture through Cloud Management.

## Browser Deployment

To deploy the Chrome browser at scale, first download the **Chrome Enterprise bundle**, which includes the installer files (MSI for Windows, PKG for macOS) and policy templates. Use an enterprise management tool (e.g., Intune, SCCM, Jamf) to deploy the installer. Finally, enroll the browsers into **Chrome Enterprise Core** for cloud-based management.

## Enrollment Tokens

Browsers become managed when an enrollment token is successfully applied to the client device.

### Enrollment Token Locations

- **Windows:** Registry key `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\CloudManagementEnrollmentToken`.
- **macOS:** Configuration profiles (`.mobileconfig`) containing the `CloudManagementEnrollmentToken`.

## Deployment of Endpoint Verification

Endpoint Verification (EV) is required to report device security posture to Context-Aware Access policies. For a successful silent deployment via MDM (like Intune):

The best practice for deploying Endpoint Verification requires two components:

1. **The Extension:** Use the ExtensionInstallForcelist policy to force-install the extension by its ID (callobklhcbilhphinckomhgkigmfocg).
2. **The Native Helper:** Use your MDM to deploy the Native Helper application (MSI for Windows, PKG for macOS) as a required installation. Both are mandatory for the feature to function.

## Unenrollment

To unenroll a device and remove Chrome Enterprise management policies:

To fully unenroll a browser, a two-step process is required:
**1) On the client device,** remove the enrollment token (from the Windows Registry at `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\CloudManagementEnrollmentToken` or a file on macOS/Linux).
**2) In the Admin Console,** manually delete the inactive browser record from the 'Managed browsers' list to complete the process.
