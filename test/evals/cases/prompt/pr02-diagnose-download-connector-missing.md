---
id: pr02
category: prompt
tags:
  - prompt
  - diagnose
scenario: download-connector-missing
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should run the full health check and identify that the file download connector is not configured while the file upload connector is active. This is a gap in content analysis coverage. Agent should flag this as a high or critical issue and recommend enabling the download connector.

## Judge Instructions

The agent MUST identify the missing download connector as an issue. If the health check reports all connectors as healthy, grade as FAIL. Other findings about the healthy parts of the environment are expected and fine.
