---
id: t02
category: troubleshooting
tags:
  - troubleshooting
expected_tools:
  - list_dlp_rules
required_patterns:
  - Block test123.com
---

## Prompt

A strict DLP rule is blocking legitimate uploads to a partner portal. Can you show me the current rule configuration so we can refine it?

## Golden Response

Agent should list current DLP rules and find 1 rule: "🤖 Block test123.com" (ACTIVE, blocks file uploads containing "test123.com"). Should suggest refinements like adding partner domain exclusions, changing action from Block to Warn, or narrowing the content condition.
