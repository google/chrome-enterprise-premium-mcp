---
id: k07
category: knowledge
tags:
  - iam
  - roles
required_patterns:
  - Security Center Admin
  - DLP
priority: P1
---

## Prompt

Our Helpdesk team needs to view CEP security dashboards and adjust DLP rules,
but we cannot give them 'Super Admin' access. What roles are required?

## Golden Response

Use delegated administrator roles rather than Super Admin:

- **Viewing dashboards:** Assign the Security Center Admin (Custom Role).
- **Managing DLP rules:** Assign the DLP Administrator (Custom Role).

## Judge Instructions

The agent must recommend delegated roles or custom roles for dashboard viewing and DLP management.
The agent MUST specifically mention 'Security Center Admin' (or refer to the specific permissions) and either 'DLP Administrator' or 'Cloud BeyondCorp Admin'.
