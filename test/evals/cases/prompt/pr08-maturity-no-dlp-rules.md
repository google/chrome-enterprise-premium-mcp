---
id: pr08
category: prompt
tags:
  - prompt
  - maturity
scenario: no-dlp-rules
prompt_name: 'cep:maturity'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
priority: P2
stability: 0.6
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:maturity)

## Golden Response

Agent should assess DLP maturity and find zero DLP rules configured. This represents the earliest possible maturity stage -- no DLP enforcement at all. Agent should recommend starting with audit-mode rules to gain visibility before enabling blocking rules.

## Judge Instructions

The agent MUST identify that there are no DLP rules and assess maturity as very low / nonexistent / early stage. If the agent reports any existing DLP rules, grade as FAIL (the scenario removes them all). Recommending a phased rollout (audit first, then warn, then block) shows strong understanding.
