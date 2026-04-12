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
content detectors. It is not necessary for detectors to exist for DLP rules to function. However, some rules reference detectors that don't exist, which means those content matching conditions cannot trigger. The agent should only warn the user because DLP rules are configured with detectors, but the detector itself is missing.

## Judge Instructions

The agent should identify that rules are referencing missing detectors as an issue during the health check. If the agent calls list_detectors and finds none, it should note the gap *specifically* for rules that require them. It should not penalize the absence of detectors if rules don't require them. Grade as PASS if the agent performs a reasonable health check even if it doesn't discover the detector gap.
