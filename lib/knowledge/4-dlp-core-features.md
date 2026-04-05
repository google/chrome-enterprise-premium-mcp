---
title: 'Chrome Data Loss Prevention (DLP) Core Features'
kind: curated
articleType: curated-guide
articleId: 4
---

# Chrome Data Loss Prevention (DLP)

Chrome Enterprise Premium includes advanced Data Loss Prevention (DLP) to protect sensitive organizational data from leaving the browser unapproved.

## DLP Rule Triggers and Content Detectors

Chrome Enterprise Premium Data Loss Prevention rules are activated when a user performs specific events within the browser:

1.  **File Uploaded:** A user uploads a file from their device.
2.  **File Downloaded:** A user downloads a file to their local machine.
3.  **Content Pasted:** A user pastes content into a webpage or application.
4.  **Content Printed:** A user prints the content of a webpage.
5.  **URL Visited:** A user navigates to a specific URL or web category.

### Content Analysis Detectors

CEP includes **more than 50 predefined sensitive data detectors** that scan content transfers for sensitive information in real-time. Use these inside CEL conditions with the `matches_dlp_detector('RESOURCE_NAME')` function.

**Common Predefined Detectors:**

- **Credit Card numbers:** `CREDIT_CARD_NUMBER`
- **US Social Security numbers:** `US_SOCIAL_SECURITY_NUMBER`
- **Email addresses:** `EMAIL_ADDRESS`
- **Phone numbers:** `PHONE_NUMBER`
- **Passport numbers:** `PASSPORT`

### 1. Screen Capture and Printing

CEP helps prevent data loss via screenshots, screen-sharing, and printing through its Data Loss Prevention (DLP) capabilities.

- **DLP Rule Configuration:** Administrators can create DLP rules in the Google Admin console with the "URL Visited" (URL_NAVIGATION) or "Content Printed" (PRINT) triggers.
- **Action within the Rule:** For URL-based rules, admins can define the action to be "Screenshare/Screenshot protection" alongside actions like "Audit," "Warn," or "Block".
- **Connector Dependency:** For these protections to work effectively, ensure the **Real-time URL check** and **Print Analysis** connectors are configured and enabled.
- **Diagnostic Step:** Always check both **active DLP rules** and **connector policies** when investigating screenshot or printing protections.
- **User Experience:** When a user navigates to a protected URL, any attempt to take a screenshot or share the screen content will be blocked by Chrome.

I can check your current DLP rules and connector policies to see if these protections are active.

### 2. Clipboard Controls (Copy/Paste)

Admins can prevent users from copying data from company apps by creating a **Paste (WEB_CONTENT_UPLOAD)** trigger rule.

- **Action:** Set the trigger to `WEB_CONTENT_UPLOAD`.
- **Filtering:** Use the `source_url` condition to restrict text copied _from_ a managed corporate application, ensuring it cannot be pasted into unapproved destinations like personal emails or web-based AI tools.

### 3. File Scanning Limits

- **Encrypted Files:** By default, password-protected or encrypted PDFs and Microsoft Office documents **might be unscannable** by the DLP engine. Rules can be configured to either allow or block these unscannable files to maintain security.
- **Size Limits:** Deep scanning is typically limited to files under 50MB, and text extraction is capped at 10MB per file.
- **Scan Latency:** Users might observe a "Scanning" delay (e.g., 10 seconds) when downloading files. This latency is controlled by the **`DelayDeliveryUntilVerdict`** setting in the File Download Analysis connector. Configuring this setting appropriately (e.g., to 'DELAY_DELIVERY_UNTIL_VERDICT_ENUM_BYPASS_ON_TIMEOUT') can help manage the user experience.

### 4. Enterprise Cache Encryption

Enterprise Cache Encryption enhances security. It encrypts local browsing data, including cache, cookies, history, and passwords in Chrome, ensuring corporate content remains inaccessible if a device is lost, stolen, or compromised.

### 5. Optical Character Recognition (OCR)

Chrome Enterprise Premium's DLP engine supports Optical Character Recognition (OCR) to detect sensitive text (like credit card numbers) inside images.

- **Supported File Types:** BMP, GIF, JPEG, PNG, and TIF.
- **Configuration:** OCR must be explicitly enabled by an administrator in the Google Admin console under Security > Access and data control > Data protection > Optical character recognition (OCR). Once enabled, DLP rules can scan text within images during uploads, downloads, pasting, or printing.

## DLP Actions and User Experience

What does the "Audit" action do in a DLP rule compared to "Warn" or "Block"? The 'Audit' action is a silent mode that logs events without notifying the end-user, useful for tuning rules during a PoC.
