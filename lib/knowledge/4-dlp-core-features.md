---
summary: 'Covers configuration of DLP triggers (Paste, Print, Upload), screenshot/screenshare protection, file size limits (50MB), and managing file scan latency (DelayDeliveryUntilVerdict). Lists 50+ predefined detectors and supported OCR image types (PNG, JPEG, etc.).'
title: 'Chrome Data Loss Prevention (DLP) Core Features'
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

CEP helps prevent data loss via screenshots, screen-sharing, and printing through its Data Loss Prevention (DLP) capabilities. It supports advanced [CEL conditions](11-dlp-cel-syntax.doc.js) and comprehensive [troubleshooting logs](6-dlp-troubleshooting.md) for debugging.

- **DLP Rule Configuration:** CEP can prevent data exfiltration via printing and screen capture using DLP rules. **Printing** is controlled with the **'Content printed'** trigger. **Screenshot and screen-sharing** protection is typically configured as an action on a **'URL Visited'** trigger, blocking captures when a user is on a sensitive site.
- **Action within the Rule:** For URL-based rules, admins can define the action to be "Screenshare/Screenshot protection" alongside actions like "Audit," "Warn," or "Block".
- **Connector Dependency:** For these protections to work effectively, ensure the **Real-time URL check** and **Print Analysis** connectors are configured and enabled.
- **Diagnostic Step:** Always check both **active DLP rules** and **connector policies** when investigating screenshot or printing protections.
- **User Experience:** When a user navigates to a protected URL, any attempt to take a screenshot or share the screen content will be blocked by Chrome.

### 2. Clipboard Controls (Copy/Paste)

Admins can prevent users from copying data from company apps by creating a **Paste (WEB_CONTENT_UPLOAD)** trigger rule.

- **Action:** Set the trigger to `WEB_CONTENT_UPLOAD`.
- **Filtering:** To control data transfer via clipboard, configure a Data Loss Prevention (DLP) rule with a **'Paste'** trigger. In the rule, specify your internal company applications in the **'Source URL'** field and external sites like ChatGPT in the **'Destination URL'** field. This will block or warn users when they attempt to paste sensitive data into unauthorized web applications.

### 3. File Scanning Limits

- **Encrypted Files:** By default, password-protected or encrypted PDFs and Microsoft Office documents **might be unscannable** by the DLP engine. Rules can be configured to either allow or block these unscannable files to maintain security.
- **Size Limits:** Deep scanning is typically limited to files under 50MB, and text extraction is capped at 10MB per file.
- **Scan Latency:** Users might observe a "Scanning" delay (e.g., 10 seconds) when downloading files. This latency is controlled by the **`DelayDeliveryUntilVerdict`** setting in the File Download Analysis connector. Configuring this setting appropriately (e.g., to 'DELAY_DELIVERY_UNTIL_VERDICT_ENUM_BYPASS_ON_TIMEOUT') can help manage the user experience.

### 4. Enterprise Cache Encryption

Enterprise Cache Encryption enhances security by encrypting a user's local Chrome profile data at rest. This includes the **HTTP cache, cookies, browsing history, and saved passwords**, preventing unauthorized access to potentially sensitive corporate data if a device is lost, stolen, or compromised.

### 5. Optical Character Recognition (OCR)

Chrome Enterprise Premium's DLP engine supports Optical Character Recognition (OCR) to detect sensitive text (like credit card numbers) inside images.

- **Supported File Types:** BMP, GIF, JPEG, PNG, and TIF.
- **Configuration:** OCR must be explicitly enabled by an administrator in the Google Admin console under **Security > Access and data control > Data protection > Optical character recognition (OCR)**. Once enabled, DLP rules can scan text within images during uploads, downloads, pasting, or printing.

## DLP Actions and User Experience

The 'Audit' action in a DLP rule is a **silent-but-log** mode. When triggered, the event is logged for administrator review, but the user's action is **not interrupted**, and they receive no warning or block message. This is primarily used for testing new rules to see what they would catch before enforcing them with 'Warn' or 'Block'.

To silently monitor user navigation, create a DLP rule using the **'URL Visited'** trigger. Set the action to **'Audit'**, which logs the event for administrators without impacting the user. The rule can target **predefined URL categories**, such as 'Social Media'.
