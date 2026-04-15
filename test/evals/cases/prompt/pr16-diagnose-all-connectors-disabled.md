---
id: pr16
category: prompt
tags:
  - prompt
  - diagnose
scenario: all-connectors-disabled
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P1
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should identify that no content analysis connectors are
configured despite active DLP rules. File uploads, downloads,
paste operations, print jobs, and URL checks are all unprotected.
This is a critical gap — DLP rules exist but cannot trigger
because the connectors that feed content to the scanning engine
are missing. Agent should recommend enabling all relevant
connectors.

## Judge Instructions

The agent MUST identify the complete absence of connectors as a
critical issue, not just flag one missing connector. It should
convey that DLP rules are effectively non-functional without
connectors. If the agent only mentions a single missing connector
or reports the environment as partially healthy, grade as FAIL.
