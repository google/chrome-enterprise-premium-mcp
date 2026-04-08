---
id: k34
category: knowledge
tags:
  - dlp
  - actions
expected_tools:
  - search_content
---

## Prompt

What does the "Audit" action do in a DLP rule compared to "Warn" or "Block"?

## Golden Response

The 'Audit only' action in a Data Loss Prevention (DLP) rule means that when the rule's conditions are met, the event is logged for administrators to review, but the end-user is not blocked or warned, and their action is not interrupted. This is useful for testing rule efficacy before full enforcement, as described in [Use Chrome Enterprise Premium to integrate DLP with Chrome](https://support.google.com/chrome/a/answer/10104358).
