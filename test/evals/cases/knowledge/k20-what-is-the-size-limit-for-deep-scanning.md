---
id: k20
category: knowledge
tags:
  - dlp
  - scanning
expected_tools:
  - search_content
required_patterns:
  - '50'
---

## Prompt

What is the size limit for deep scanning files?

## Golden Response

The size limit for file content deep scanning (for DLP and malware) in Chrome Enterprise Premium is 50MB., files larger than this cannot be scanned. You can configure the behavior for unscannable files, including those exceeding the size limit, in the [Chrome Enterprise Connector settings](https://support.google.com/chrome/a/answer/10106035).
