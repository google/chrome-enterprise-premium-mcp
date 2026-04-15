---
id: i04
category: inspection
tags:
  - inspection
expected_tools:
  - diagnose_environment
priority: P0
stability: 0.9
---

## Prompt

Run a health check on my Chrome Enterprise Premium deployment. Check my subscription, org structure, browser versions, and DLP rules.

## Golden Response

Agent should attempt a comprehensive check. It should report on the areas: Active subscription, 2 OUs configured, Browser versions (either total counts or specific breakdown), and 1 DLP rule identified as "Active".

## Judge Instructions

This is a comprehensive health check. The agent should use diagnose_environment and synthesize findings into a summary. It should report the active subscription status, OUs, browser version information, and DLP rule status, providing a cohesive summary of the successful findings.
