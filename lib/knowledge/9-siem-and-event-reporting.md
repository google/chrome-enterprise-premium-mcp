---
title: 'Chrome Reporting Connector and SIEM Integration'
kind: curated
articleType: curated-guide
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
   - The **Security Events Reporting** policy must be applied to the desired Organizational Units (OUs).
3. **Google Cloud Console (GCP) Configuration:**
   - An active and linked Google Cloud billing account is necessary.
   - Appropriate IAM roles and permissions must be granted to administrators in both the Google Admin Console and the Google Cloud Console.

### Common Troubleshooting Steps

- **Empty Dashboard / No Data:** After initial setup or changes, it can take time for policies to propagate to all browsers and for data to start populating (license propagation delays). Verify all licensing, Admin Console settings, and GCP IAM permissions. Check `chrome://policy` on the client device.
- **Permission Issues / Cannot Enable Insights:** Enabling features may require specific privileges. Ensure the administrator has sufficient rights in both Google Admin Console and GCP.

## SIEM Troubleshooting (e.g., Splunk)

If you configured the Reporting Connector to send CEP events to Splunk, but the dashboard is empty, I can verify if the **Security Events Reporting** policy is enabled for your endpoints by checking your connector policies.

## Missing Reporting Data

If we are not seeing any data in the Chrome security event dashboard, check `chrome://safe-browsing/#tab-reporting` on the device locally.
