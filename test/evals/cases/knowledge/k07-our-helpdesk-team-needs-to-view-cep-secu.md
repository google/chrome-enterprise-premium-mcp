---
id: k07
category: knowledge
tags:
  - iam
  - roles
expected_tools:
  - search_content
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

- **Viewing dashboards:** Assign the Security Center Admin role.
- **Managing DLP rules:** Assign the DLP Administrator role.
- **Context-Aware Access:** Assign the BeyondCorp Admin IAM role.

## Judge Instructions

The agent must recommend delegated roles for dashboard viewing, DLP management,
and Context-Aware Access. The agent MUST specifically mention 'Security Center Admin',
'DLP Administrator', and 'BeyondCorp Admin' to align with Chrome Enterprise Premium standards.
