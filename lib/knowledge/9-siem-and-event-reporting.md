---
summary: 'Details the requirements and troubleshooting steps for Chrome Reporting Connector and SIEM integration (like Splunk) to track security insights.'
title: 'Chrome Reporting Connector and SIEM Integration'
articleId: 9
---

# SIEM Integration and Event Reporting

Chrome Enterprise Premium allows security events generated in the browser to be sent directly to your SIEM system.

## Security Insights Requirements and Troubleshooting

To effectively use Security Insights within Chrome Enterprise Premium, several requirements must be met:

1. **Licensing:** A valid Chrome Enterprise Premium license or active trial is required, and users need Google Cloud Identity licenses.
2. **Google Admin Console Configuration:**
   - The **Chrome Enterprise Security Services App** must be enabled.
   - The **Data Protection Insight Scanning and Report** global setting must be enabled.
   - The **Event Reporting** policy must be applied to the desired Organizational Units (OUs).
3. **Google Cloud Console (GCP) Configuration:**
   - An active and linked Google Cloud billing account is necessary.
   - Appropriate IAM roles and permissions must be granted to administrators in both the Google Admin Console and the Google Cloud Console.

### Common Troubleshooting Steps

- **Empty Dashboard / No Data:** After initial setup or changes, it can take time for policies to propagate to all browsers and for data to start populating (license propagation delays). Verify all licensing, Admin Console settings, and GCP IAM permissions. Check `chrome://policy` on the client device.
- **Permission Issues / Cannot Enable Insights:** Enabling features may require specific privileges. Ensure the administrator has sufficient rights in both Google Admin Console and GCP.

## SIEM Troubleshooting (e.g., Splunk)

To send events to a SIEM like Splunk, the Chrome Reporting Connector must be configured in Google Cloud. If the dashboard is empty, it strongly indicates that the specific **Event Reporting** policy, which activates this connector, has not been enabled for the user's OU.

## Missing Reporting Data

If the Chrome security event dashboard is empty, verify the following: **1) Client-side:** Check chrome://safe-browsing/#tab-reporting on a user's device to see if events are being generated locally. **2) Admin Console:** Ensure 'Event reporting' is enabled under the browser reporting settings. **3) Licensing:** Confirm users have active CEP licenses assigned and the reporting connector is configured if sending to a SIEM.
