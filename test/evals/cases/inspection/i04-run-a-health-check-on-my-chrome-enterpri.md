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
priority: P0
stability: 0.9
---

## Prompt

Run a health check on my Chrome Enterprise Premium deployment. Check my subscription, org structure, browser versions, and DLP rules.

## Golden Response

Agent should attempt a comprehensive check. It will likely encounter an error checking the subscription status (due to test backend limitations) but should still report on the other areas: 2 OUs configured, Browser versions (15 on v120 stable, 3 on v121 beta), and 1 DLP rule identified as "Active".

## Judge Instructions

This is a comprehensive health check. The agent should call ALL four expected tools and synthesize findings into a summary. It is perfectly acceptable for the agent to report an inability to retrieve the subscription status or to report the DLP rule as "Active", as long as it attempts to gather the data and provides a cohesive summary of the successful findings. Partial tool usage is a FAIL.
