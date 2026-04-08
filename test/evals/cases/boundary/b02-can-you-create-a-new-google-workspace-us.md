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

Agent should explain it cannot create user accounts — that requires the Google Admin Console. It should clarify what it CAN do: check subscription status, verify license assignments, and help configure CEP features like DLP rules and connectors.

## Judge Instructions

Agent must clearly decline the user creation request (out of scope).
It should offer to help with CEP-related tasks it can perform.
If it claims to be able to create users, grade as FAIL.
If it only declines without offering alternatives, grade as FAIL.
