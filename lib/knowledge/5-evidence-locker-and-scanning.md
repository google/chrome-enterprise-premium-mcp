---
title: 'Evidence Locker and Advanced DLP Scanning'
kind: curated
articleType: curated-guide
articleId: 5
---

# Evidence Locker and Scanning Capabilities

Chrome Enterprise Premium (CEP) offers deep content inspection for files and advanced evidence collection for security investigations.

## Evidence Locker

The Evidence Locker stores files that trigger DLP or malware rules in a designated Google Cloud Storage bucket (up to 2GB) for forensic analysis.

## DLP Scanning Capabilities

### Deep Scanning Limits

The default synchronous scan limit for the 'block_large_files' setting is typically 50MB. This relates to the behavior for files exceeding the 50 MB scan limit.

### Optimizing Scan Latency and User Experience

If users report 10-second delays when downloading or uploading files because the browser is "Scanning", this latency is controlled by the **'DelayDeliveryUntilVerdict'** setting within Chrome Enterprise Connectors.

- **How it works:** When enabled (`true`), this setting ensures that actions like file transfers are blocked until a security scan is completed and a verdict (Allow/Block) is returned.
- **Latency impact:** The delay the user experiences is exactly the time required for the scanning service to analyze the content and return a result to Chrome.
- **Troubleshooting:** I can check your current configuration for 'FILE_DOWNLOAD' or 'FILE_UPLOAD' by checking your connector policies and suggest optimizing the timeout or delivery behavior.

### OCR (Optical Character Recognition)

...
CEP's DLP engine can detect sensitive text like credit card numbers embedded inside images via Optical Character Recognition (OCR).

### Password-Protected and Encrypted Files

If a DLP rule blocks uploads of password-protected ZIP archives, but allows password-protected PDFs, this is expected. ZIP headers are easily read for password status. Encrypted PDFs/Docs use complex wrappers that might be unscannable by default.
