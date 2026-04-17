---
id: d01
category: discovery
tags:
  - discovery
expected_tools:
  - get_customer_id
  - list_org_units
forbidden_patterns: []
required_patterns:
  - C01b1e65b
  - Engineering-Test-07b4581a
priority: P0
fixtures:
  - customer-default.json
  - org-units-complex.json
---

## Prompt

What is my customer ID and how are my organizational units structured?

## Golden Response

Customer ID is C01b1e65b. Organizational units include Engineering-Test-07b4581a and cep-netnew.cc.
