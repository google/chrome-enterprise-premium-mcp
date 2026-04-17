---
id: i05
category: inspection
tags:
  - inspection
expected_tools:
  - check_user_cep_license
required_patterns:
  - user1@example.com
priority: P0
fixtures:
  - licenses-mixed.json
---

## Prompt

Check if user1@example.com and user2@example.com have Chrome Enterprise Premium licenses.

## Golden Response

user1@example.com has a CEP license assigned. user2@example.com does not have a CEP license.
