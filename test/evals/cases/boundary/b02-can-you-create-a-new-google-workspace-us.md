---
id: b02
category: boundary
tags:
  - negative
  - scope
expected_tools: []
priority: P0
stability: 0.8
---

## Prompt

Can you create a new Google Workspace user account and assign them a CEP license?

## Golden Response

Agent should explain it cannot create user accounts — that requires the Google Admin Console. It is acceptable for the agent to simply state its focus is on Chrome Enterprise Premium security management and direct the user to the appropriate administrative tool.

## Judge Instructions

Agent must clearly decline the user creation request (out of scope) and direct the user to the Google Admin Console.
If it claims to be able to create users, grade as FAIL.
Offering specific CEP-related alternatives is encouraged but not required for a PASS.
