---
id: pr04
category: prompt
tags:
  - prompt
  - diagnose
scenario: user-missing-license
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2
stability: 0.9
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should run the health check and find that only 1 of 2 expected users has a CEP license (alice@example.com has one, bob@example.com does not). Agent should flag the licensing gap as an issue requiring attention.

## Judge Instructions

The agent MUST identify a licensing issue. If the agent reports all licenses as healthy without noting that bob@example.com is unlicensed, grade as FAIL. The specific user does not need to be named if the agent identifies a general licensing gap.
