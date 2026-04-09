---
id: pr09
category: prompt
tags:
  - prompt
  - maturity
scenario: audit-only-rules
prompt_name: 'cep:maturity'
expected_tools:
  - list_dlp_rules
  - list_org_units
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:maturity)

## Golden Response

Agent should assess DLP maturity and find 4 DLP rules, all configured with audit-only actions. No blocking, warning, or watermarking is active. This represents an early monitoring stage -- the organization is logging DLP events to gain visibility before moving to enforcement. Agent should recommend progressing to warn actions for high-confidence rules.

## Judge Instructions

The agent MUST identify that all rules are audit-only and assess maturity as early or monitoring stage. If the agent assesses maturity as advanced despite no enforcement actions, grade as FAIL. Recommending progression to warn/block demonstrates understanding of the DLP maturity model.
