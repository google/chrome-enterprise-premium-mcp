---
id: pr19
category: prompt
tags:
  - prompt
  - diagnose
scenario: no-subscription
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P1
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should identify no CEP licenses assigned as a critical
issue. This is the most fundamental problem — without licenses,
no CEP features are active for any user. The agent should
recommend purchasing and assigning licenses as the top priority.

## Judge Instructions

The agent MUST flag the missing subscription as a critical
issue. If it reports the environment as healthy or focuses
on other issues without mentioning the licensing gap, grade
as FAIL.
