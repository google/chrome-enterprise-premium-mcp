---
id: pr17
category: prompt
tags:
  - prompt
  - diagnose
scenario: no-detectors
prompt_name: 'cep:diagnose'
expected_tools:
  - list_org_units
  - list_dlp_rules
priority: P2
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:diagnose)

## Golden Response

Agent should run the health check and find 4 active DLP rules but no custom
content detectors. Some rules reference detectors that don't exist, which means
those content matching conditions cannot trigger. The agent should flag this
gap.

## Judge Instructions

The agent should identify the absence of detectors as an issue during the health
check. If the agent calls list_detectors and finds none, it should note the gap.
If it doesn't check detectors at all but otherwise provides a complete health
check, that is acceptable — the diagnose prompt doesn't strictly require
detector checks. Grade as PASS if the agent performs a reasonable health check
even if it doesn't discover the detector gap.
