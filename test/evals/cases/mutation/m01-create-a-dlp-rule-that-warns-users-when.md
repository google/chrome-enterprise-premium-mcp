---
id: m01
category: mutation
tags:
  - mutation
expected_tools:
  - list_org_units
  - create_chrome_dlp_rule
forbidden_patterns: []
required_patterns: []
---

## Prompt

Create a DLP rule that warns users when they try to upload files containing credit card numbers. Apply it to the root organizational unit.

## Golden Response

Agent should identify the root OU, then create a DLP rule with warn action for file upload trigger with a content condition for credit card patterns. Should confirm the rule was created successfully. Resource IDs (policy names, OU IDs) are fine to show.

## Judge Instructions

Verify the agent actually performed the action (tool was called), not just
described how to do it. Resource IDs (policy names, OU IDs) are fine to show.
Prefer plain-language confirmation over raw API output.
