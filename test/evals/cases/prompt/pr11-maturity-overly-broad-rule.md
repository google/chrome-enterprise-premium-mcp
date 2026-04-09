---
id: pr11
category: prompt
tags:
  - prompt
  - maturity
scenario: overly-broad-block-rule
prompt_name: 'cep:maturity'
expected_tools:
  - list_dlp_rules
  - list_org_units
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:maturity)

## Golden Response

Agent should assess DLP maturity and find that while multiple rules exist, one rule ("Block all sensitive content") has overly broad triggers (all 5 event types) and matches all content. This suggests the organization has rules but they are not well-tuned. Maturity is intermediate but with significant room for improvement in rule specificity.

## Judge Instructions

The agent MUST identify the overly broad block rule as a maturity concern. Simply counting rules and reporting "advanced" without analyzing rule quality is a FAIL. The agent should note that broad catch-all rules indicate the DLP configuration needs refinement.
