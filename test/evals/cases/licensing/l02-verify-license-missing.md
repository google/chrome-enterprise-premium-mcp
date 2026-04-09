---
id: l02
category: licensing
tags:
  - licensing
expected_tools:
  - check_user_cep_license
forbidden_patterns: []
required_patterns:
  - user1@example.com
  - does NOT have
priority: P1
fixtures:
  - license-missing.json
---

## Prompt

Check if user1@example.com has a Chrome Enterprise Premium license.

## Golden Response

User 'user1@example.com' does NOT have a Chrome Enterprise Premium (CEP) license assigned.
