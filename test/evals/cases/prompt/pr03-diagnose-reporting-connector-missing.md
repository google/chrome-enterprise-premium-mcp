---
id: pr03
category: prompt
tags:
  - prompt
  - diagnose
scenario: reporting-connector-missing
prompt_name: 'cep:diagnose'
expected_tools:
  - diagnose_environment
priority: P2
stability: 0.9
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:diagnose)

## Golden Response

Agent should run the full health check and identify that the security event reporting connector (OnSecurityEvent) is not configured. Without this, no security events are forwarded to SIEM. Agent should flag this as an issue and recommend configuring the reporting connector.

## Judge Instructions

The agent MUST identify that security event reporting is not configured. If the agent reports all connectors as healthy without noting the missing reporting/security event connector, grade as FAIL.
