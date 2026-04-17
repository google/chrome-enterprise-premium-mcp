--- CASE ---

id: k16
category: knowledge
tags:
  - dlp
  - copy-paste
required_patterns:
  - DLP
priority: P2

## Prompt

How can I prevent users from copying data from company apps to personal apps like ChatGPT?

## Golden Response

You can configure Data Loss Prevention (DLP) rules in the Admin Console to control copy and paste actions. Specify your company apps as the 'Source URL' and sites like ChatGPT as the destination URL or URL Category.

--- CASE ---

id: k19
category: knowledge
tags:
  - dlp
  - encrypted-files
priority: P2

## Prompt

My DLP rule blocks uploads of password-protected ZIP archives, but allows password-protected PDFs. Is this expected?

## Golden Response

This behavior is generally expected. Detecting password protection is often more reliable for ZIP archives due to their header structure. Encrypted PDFs and Office documents can be harder to identify as password-protected without attempting to open them. CEP cannot scan the _content_ of password-protected files. However, you can choose to block all password-protected files (that can be detected) within the Chrome Enterprise Connector settings.

--- CASE ---

id: k20
category: knowledge
tags:
  - dlp
  - scanning
required_patterns:
  - '50'
priority: P1

## Prompt

What is the size limit for deep scanning files?

## Golden Response

The size limit for file content deep scanning (for DLP and malware) in Chrome Enterprise Premium is 50MB., files larger than this cannot be scanned. You can configure the behavior for unscannable files, including those exceeding the size limit, in the Chrome Enterprise Connector settings.

--- CASE ---

id: k21
category: knowledge
tags:
  - dlp
  - ocr
required_patterns:
  - OCR
priority: P2

## Prompt

Can CEP's DLP engine detect sensitive text like credit card numbers embedded inside images?

## Golden Response

Yes, Chrome Enterprise Premium's DLP engine can detect sensitive text within images by using Optical Character Recognition (OCR). This feature needs to be explicitly enabled in the Google Admin Console.

--- CASE ---

id: k34
category: knowledge
tags:
  - dlp
  - actions
priority: P1

## Prompt

What does the "Audit" action do in a DLP rule compared to "Warn" or "Block"?

## Golden Response

The 'Audit only' action in a Data Loss Prevention (DLP) rule means that when the rule's conditions are met, the event is logged for administrators to review, but the end-user is not blocked or warned, and their action is not interrupted. This is useful for testing rule efficacy before full enforcement.
