---
id: pr20
category: prompt
tags:
  - prompt
  - diagnose
scenario: upload-connector-missing
prompt_name: 'cep:diagnose'
expected_tools:
  - diagnose_environment
priority: P2
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:diagnose)

## Golden Response

Agent should identify that the file upload content analysis
connector is not configured. File uploads go unscanned, meaning
DLP rules with upload triggers cannot detect sensitive content.
The download connector IS configured, so only uploads are the gap.

## Judge Instructions

The agent MUST identify the missing upload connector as an issue.
If it reports all connectors as healthy, grade as FAIL. Noting
that the download connector is active while upload is missing
is a plus but not required.
