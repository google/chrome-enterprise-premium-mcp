---
id: k19
category: knowledge
tags:
  - dlp
  - encrypted-files
expected_tools:
  - search_content
---

## Prompt

My DLP rule blocks uploads of password-protected ZIP archives, but allows password-protected PDFs. Is this expected?

## Golden Response

This behavior is generally expected. Detecting password protection is often more reliable for ZIP archives due to their header structure. Encrypted PDFs and Office documents can be harder to identify as password-protected without attempting to open them. CEP cannot scan the _content_ of password-protected files. However, you can choose to block all password-protected files (that can be detected) within the [Chrome Enterprise Connector settings](https://support.google.com/chrome/a/answer/10106035).
