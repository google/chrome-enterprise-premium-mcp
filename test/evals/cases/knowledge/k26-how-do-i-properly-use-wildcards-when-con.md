---
id: k26
category: knowledge
tags:
  - url-filtering
expected_tools:
  - search_content
---

## Prompt

How do I properly use wildcards when configuring URL filtering policies in CEP?

## Golden Response

When configuring URL filtering policies in Chrome Enterprise Premium, the wildcard usage is as follows:

- `example.com`: This will match `example.com` and all its subdomains (e.g., `www.example.com`, `app.example.com`).
- `.example.com`: Use this syntax to match _only_ the exact domain `example.com` and NOT its subdomains.
- `*`: This acts as a general wildcard, often used for matching any URL in certain policy contexts, but should be used carefully to avoid unintended blocking or allowing.
  You can find more details on the format in the [URL blocklist filter format](https://support.google.com/chrome/a/answer/9942583) Help Center article.
