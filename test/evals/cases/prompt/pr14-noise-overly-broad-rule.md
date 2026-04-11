---
id: pr14
category: prompt
tags:
  - prompt
  - noise
scenario: overly-broad-block-rule
prompt_name: 'cep:noise'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
priority: P2
stability: 0.1
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:noise)

## Golden Response

Agent should analyze DLP rules and activity logs. The "Block all sensitive content" rule matches all content across all 5 trigger types, which is a recipe for high noise and user friction. Even if current event volume is low, the agent should flag this rule's configuration as a noise risk due to its overly broad conditions and recommend narrowing triggers and tightening the content condition.

## Judge Instructions

The agent MUST identify the overly broad block rule as a potential noise source based on its configuration (all triggers, match-all condition), even if current event counts are modest. Simply reporting event counts without analyzing rule configuration quality is insufficient. Recommending specific narrowing actions counts as a strong PASS.
