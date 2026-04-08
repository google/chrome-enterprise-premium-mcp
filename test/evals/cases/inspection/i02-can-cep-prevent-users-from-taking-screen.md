---
id: i02
category: inspection
tags:
  - inspection
expected_tools:
  - list_dlp_rules
  - get_connector_policy
  - search_content
---

## Prompt

Can CEP prevent users from taking screenshots or printing sensitive data? Check if we have any protections active.

## Golden Response

Yes, Chrome Enterprise Premium can prevent or warn on these actions. As detailed in [Use Chrome Enterprise Premium to integrate DLP with Chrome](https://support.google.com/chrome/a/answer/10104358), you can use Data Loss Prevention (DLP) rules with the 'Content printed' trigger. For screenshots and screen-sharing, this is often configured within a DLP rule as an additional action when a user visits sensitive URLs. The agent's check of your current DLP rules indicates no active rules for printing or screenshot protection. You would need to create or modify rules to include these protections.
