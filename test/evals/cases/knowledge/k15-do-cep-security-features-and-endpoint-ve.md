---
id: k15
category: knowledge
tags:
  - incognito
expected_tools:
  - search_content
priority: P2
---

## Prompt

Do CEP security features and Endpoint Verification work when a user is in Incognito mode?

## Golden Response

By default, extensions like Endpoint Verification are not active in Incognito mode. Administrators must configure Chrome policies to force-enable necessary extensions in Incognito. Furthermore, as mentioned, Chrome Enterprise Premium can be configured with Context-Aware Access rules to block access to corporate applications if users are using Incognito mode, or if a managed profile with Endpoint Verification is not detected.
