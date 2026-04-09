---
id: pr10
category: prompt
tags:
  - prompt
  - maturity
prompt_name: "cep:maturity"
expected_tools:
  - list_dlp_rules
  - list_org_units
  - get_chrome_activity_log
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:maturity)

## Golden Response

Agent should assess DLP maturity and find 4 active DLP rules across multiple OUs covering block, watermark, audit, and warn actions. Activity logs show DLP events being triggered. This represents an advanced maturity stage with a layered approach. Agent may recommend further refinements but should acknowledge the strong foundation.

## Judge Instructions

The agent MUST identify multiple active DLP rules with different action types and assess maturity as intermediate or advanced. Identifying that the organization uses a mix of block, warn, audit, and watermark actions demonstrates understanding of DLP maturity. If the agent says there are no rules or assesses maturity as early/nonexistent, grade as FAIL.
