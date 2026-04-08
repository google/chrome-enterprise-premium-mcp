---
id: m03
category: mutation
tags:
  - mutation
expected_tools:
  - list_dlp_rules
  - delete_agent_dlp_rule
forbidden_patterns: []
required_patterns: []
---

## Prompt

The '🤖 Block test123.com' DLP rule is causing too many false positives. Please remove it.

## Golden Response

Agent should delete the '🤖 Block test123.com' rule. Should confirm the rule was removed.

## Judge Instructions

Verify the agent actually performed the action (tool was called), not just
described how to do it. Resource IDs (policy names, rule names) are fine.
