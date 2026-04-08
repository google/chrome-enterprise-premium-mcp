---
id: k31
category: knowledge
tags:
  - safe-browsing
expected_tools:
  - search_content
required_patterns:
  - SafeBrowsingAllowlistDomains
---

## Prompt

Safe Browsing is blocking a legitimate internal site, showing a red warning screen. How do we bypass this?

## Golden Response

To prevent Safe Browsing from blocking a legitimate internal site, add the domain to the '[SafeBrowsingAllowlistDomains](https://chromeenterprise.google/policies/#SafeBrowsingAllowlistDomains)' policy in the Google Admin Console.
