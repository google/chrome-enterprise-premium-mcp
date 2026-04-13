---
id: pr17
category: prompt
tags:
  - prompt
  - diagnose
scenario: no-detectors
prompt_name: 'cep:diagnose'
expected_tools:
  - diagnose_environment
priority: P2
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:diagnose)

## Golden Response

The agent should run the health check and find 4 active DLP rules, but zero custom content detectors. While it's perfectly valid to have DLP rules without custom detectors, if an active rule explicitly references a detector that does not exist, that rule will fail to trigger. The agent should warn the user about this broken reference.

## Judge Instructions

Grade as PASS if the agent performs a reasonable health check and summarizes the environment.

To earn an Excellent grade, the agent must specifically notice the broken reference: active DLP rules exist that rely on custom detectors, but `list_detectors` returns empty. The agent should NOT penalize the environment if no rules require detectors.
