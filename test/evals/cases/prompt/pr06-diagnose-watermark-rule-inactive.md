---
id: pr06
category: prompt
tags:
  - prompt
  - diagnose
scenario: watermark-rule-inactive
prompt_name: "cep:diagnose"
expected_tools:
  - list_org_units
  - list_dlp_rules
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:diagnose)

## Golden Response

Agent should run the health check and find the "Watermark confidential documents" DLP rule exists but has state INACTIVE. Three other DLP rules are active. Agent should flag the inactive rule as an issue since it is not providing the intended protection for printed confidential content.

## Judge Instructions

The agent MUST identify that a watermark rule exists but is INACTIVE. Simply reporting "4 DLP rules found" without noting the inactive state is a FAIL. The agent should recommend activating it.
