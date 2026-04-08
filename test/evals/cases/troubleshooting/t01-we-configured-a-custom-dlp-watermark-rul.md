---
id: t01
category: troubleshooting
tags:
  - troubleshooting
expected_tools:
  - check_user_cep_license
  - list_dlp_rules
---

## Prompt

We configured a custom DLP watermark rule for an OU, but it's not working for user user1@example.com in that OU. Can you investigate?

## Golden Response

Agent should verify user1@example.com has a CEP license (they do) and list active DLP rules. Should find only 1 rule ("🤖 Block test123.com") and note there is no watermark rule configured, which explains the issue.
