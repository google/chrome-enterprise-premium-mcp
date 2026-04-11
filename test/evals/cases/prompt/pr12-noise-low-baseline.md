---
id: pr12
category: prompt
tags:
  - prompt
  - noise
scenario: healthy
prompt_name: 'cep:noise'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:noise)

## Golden Response

Agent should analyze DLP rules and activity logs to assess noise levels. The activity log shows 3 events: one block, one warn, one audit, each from a different rule. With a small number of events across multiple rules, there is no obvious high-noise rule. Agent should report current noise levels and recommend continued monitoring as the deployment matures.

## Judge Instructions

The agent MUST examine both DLP rules and activity logs. If the agent only lists rules without checking activity data, grade as FAIL. With the limited event data available, identifying that noise levels are low or that more data is needed for a comprehensive analysis is acceptable.
