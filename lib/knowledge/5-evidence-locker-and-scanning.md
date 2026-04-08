---
summary: 'Details the Evidence Locker for forensic file storage (which the agent cannot access directly) and advanced DLP scanning limits and latency settings.'
title: 'Evidence Locker and Advanced DLP Scanning'
articleId: 5
---

# Evidence Locker and Scanning Capabilities

For more details on configuring these settings, please refer to the [Evidence locker Help Center article](https://support.google.com/a/answer/15720950).

Chrome Enterprise Premium (CEP) offers deep content inspection for files and advanced evidence collection for security investigations.

## Evidence Locker

The Evidence Locker saves copies of files that trigger security rules to a Google Cloud Storage bucket for forensic analysis. It is critical to note that the AI agent **cannot** access the content of these files; it can only view metadata logs. An administrator must manually download the password-protected files from the storage bucket for inspection.

## DLP Scanning Capabilities

### Deep Scanning Limits

The size limit for deep content scanning of files (for DLP and malware) is **50MB**. Files larger than this cannot be scanned. Administrators can configure a policy to either **allow or block** files that are considered unscannable, including those that exceed the size limit.

### Optimizing Scan Latency and User Experience

If users report 10-second delays when downloading or uploading files because the browser is "Scanning", this latency is controlled by the **'DelayDeliveryUntilVerdict'** setting within Chrome Enterprise Connectors.

- **How it works:** When enabled (`true`), this setting ensures that actions like file transfers are blocked until a security scan is completed and a verdict (Allow/Block) is returned.
- **Latency impact:** The 'Scanning' delay is expected if the **‘Delay analysis’** setting is enabled within the Chrome Enterprise connectors. For fine-tuning, administrators can also use the **'Configurable Timeout Deadline'** feature to prevent excessively long waits on large files.
- **Troubleshooting:** Check the current connector policy configuration for FILE_DOWNLOAD or FILE_UPLOAD to determine whether timeout or delivery behavior settings need adjustment.

### OCR (Optical Character Recognition)

...
CEP's DLP engine can detect sensitive text like credit card numbers embedded inside images via Optical Character Recognition (OCR).

### Password-Protected and Encrypted Files

It is expected for DLP to more reliably detect password protection on ZIP archives than on PDF or Office documents due to differences in file structures. While CEP cannot scan the _content_ of any password-protected file, administrators can configure a policy to block all files that are detected as unscannable.
