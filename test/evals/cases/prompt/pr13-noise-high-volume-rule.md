---
id: pr13
category: prompt
tags:
  - prompt
  - noise
scenario: high-noise-rule
prompt_name: "cep:noise"
expected_tools:
  - list_dlp_rules
  - get_chrome_activity_log
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:noise)

## Golden Response

Agent should analyze DLP rules and activity logs and identify that the "Audit pastes to generative AI sites" rule is generating significantly more events than other rules (24 events vs 1 from the block rule). Multiple users across multiple days are triggering it. Agent should flag this as a high-noise rule and recommend either tightening the rule's conditions, switching to a more targeted URL list, or accepting the volume if monitoring GenAI usage is a priority.

## Judge Instructions

The agent MUST identify the audit rule as the highest-noise rule by analyzing event counts. If the agent reports all rules as equally noisy or fails to correlate events to specific rules, grade as FAIL. Concrete recommendations for reducing noise (narrowing conditions, refining URL matching, or accepting noise with justification) are required for PASS.
