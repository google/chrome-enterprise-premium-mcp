---
id: pr01
category: prompt
tags:
  - prompt
  - diagnose
scenario: healthy
prompt_name: 'cep:diagnose'
expected_tools:
  - diagnose_environment
priority: P2
stability: 0.1
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:diagnose)

## Golden Response

The base state is a fully healthy environment. Agent should report: 3 OUs configured, 4 active DLP rules, all connectors configured (file upload, file download, bulk text, print, URL check, security events), SEB extension force-installed, CEP subscription active with 2 licenses, browser versions current. The health check should show mostly green/healthy status with no critical issues.

## Judge Instructions

This is a healthy environment. The agent should report a clean bill of health across all checked areas. If the agent flags critical or high-severity issues that do not actually exist in the data, grade as FAIL. Minor recommendations (e.g., "consider adding more DLP rules") are acceptable.
