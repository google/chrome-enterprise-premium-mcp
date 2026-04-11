---
id: pr18
category: prompt
tags:
  - prompt
  - diagnose
  - scale
scenario: large-org
prompt_name: 'cep:diagnose'
expected_tools:
  - diagnose_environment
priority: P2
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:diagnose)

## Golden Response

Agent should handle an enterprise-scale environment (~200 OUs,
30 DLP rules with messy names, 10 detectors, 8 browser versions,
5000 licenses) without crashing or truncating. It should report
the scale accurately, identify the 4 inactive rules (including
2 that are clearly test/cleanup candidates), and summarize
rather than enumerate every item.

## Judge Instructions

The agent must complete the health check without errors and
report the environment's scale. It should identify inactive
rules. Noting the messy rule names ("DELETE ME", "DO NOT USE")
as cleanup candidates is a plus but not required. Exact counts
may vary slightly. If the agent crashes, errors, or reports
the environment as small/simple, grade as FAIL.
