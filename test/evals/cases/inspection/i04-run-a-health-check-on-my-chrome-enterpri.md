---
id: i04
category: inspection
tags:
  - inspection
expected_tools:
  - check_cep_subscription
  - list_org_units
  - count_browser_versions
  - list_dlp_rules
---

## Prompt

Run a health check on my Chrome Enterprise Premium deployment. Check my subscription, org structure, browser versions, and DLP rules.

## Golden Response

CEP subscription active (1 license). 2 OUs configured. Browser versions: 15 on v120 stable, 3 on v121 beta. 1 DLP rule active ("🤖 Block test123.com"). Agent should provide a summary assessment.

## Judge Instructions

This is a comprehensive health check. The agent should call ALL four expected tools and synthesize findings into a summary. Partial tool usage (e.g., only checking subscription) is a FAIL. The summary should note both healthy aspects and areas for improvement.
