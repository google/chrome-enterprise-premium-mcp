---
id: pr12
category: prompt
tags:
  - prompt
  - noise
scenario: healthy
prompt_name: 'cep:optimize'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
priority: P2
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:optimize)

## Golden Response

Agent should analyze DLP rules and activity logs to assess noise levels. The activity log shows 3 events: one block, one warn, one audit, each from a different rule. With a small number of events across multiple rules, there is no obvious high-noise rule. Agent should report current noise levels and recommend continued monitoring as the deployment matures.

## Judge Instructions

The agent MUST examine both DLP rules and activity logs. If the agent fails to fetch the activity log entirely, grade as FAIL. If the agent fetches the log and provides an optimization assessment (even if it focuses more on rule configuration than citing specific low event counts), it is acceptable and should PASS.
