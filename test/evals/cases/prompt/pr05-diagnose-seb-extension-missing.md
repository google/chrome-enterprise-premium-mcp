---
id: pr05
category: prompt
tags:
  - prompt
  - diagnose
scenario: seb-extension-missing
prompt_name: "cep:diagnose"
expected_tools:
  - list_org_units
  - check_seb_extension_status
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:diagnose)

## Golden Response

Agent should run the health check and find that the Safe Enterprise Browsing extension is not force-installed. This is a gap in the security posture -- without SEB, data masking DLP features cannot function. Agent should flag this as an issue and recommend deploying the extension.

## Judge Instructions

The agent MUST identify that the SEB extension is not deployed. If the agent reports extension status as healthy, grade as FAIL. Bonus if the agent connects the missing extension to data masking being unavailable.
