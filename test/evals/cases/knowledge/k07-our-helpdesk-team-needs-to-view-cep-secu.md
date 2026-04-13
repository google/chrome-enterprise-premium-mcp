---
id: k07
category: knowledge
tags:
  - iam
  - roles
expected_tools:
  - search_content
required_patterns:
  - DLP
priority: P1
---

## Prompt

Our Helpdesk team needs to view CEP security dashboards and adjust DLP rules, but we cannot give them 'Super Admin' access. What roles are required?

## Golden Response

You should create custom administrator roles in the Google Admin Console and Google Cloud. Based on the permissions required:

- **Viewing dashboards:** Roles with 'Chrome Security Insights / View' permissions.
- **Managing DLP rules:** Roles with 'DLP / Manage DLP rule' permissions.

## Judge Instructions

The agent must recommend delegated roles for both dashboard viewing and DLP
management. Exact role names may vary — what matters is that the agent
identifies the two permission areas and recommends appropriate roles for each.
