---
id: pr07
category: prompt
tags:
  - prompt
  - diagnose
scenario: multiple-faults
prompt_name: 'cep:diagnose'
expected_tools:
  - diagnose_environment
priority: P2
stability: 0.0
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:diagnose)

## Golden Response

Agent should run a comprehensive health check and find multiple issues: (1) the file download connector is not configured, (2) the SEB extension is not force-installed, and (3) bob@example.com is missing a CEP license. A real environment often has multiple gaps, and the agent should identify all of them rather than stopping after finding one.

## Judge Instructions

The agent MUST identify at least 2 of the 3 issues (missing download connector, missing SEB extension, unlicensed user). Finding only 1 issue is a FAIL. The agent does not need to find all 3 to pass, but identifying all 3 demonstrates thorough investigation.
