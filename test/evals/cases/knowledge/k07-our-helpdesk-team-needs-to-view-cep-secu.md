---
id: k07
category: knowledge
tags:
  - iam
  - roles
expected_tools:
  - search_content
required_patterns:
  - Security Center
priority: P1
---

## Prompt

Our Helpdesk team needs to view CEP security dashboards and adjust DLP rules, but we cannot give them 'Super Admin' access. What roles are required?

## Golden Response

You should create custom administrator roles in the Google Admin Console and Google Cloud. Based on the permissions required:

- **Viewing dashboards:** Roles with 'Chrome Security Insights / View' permissions.
- **Managing DLP rules:** Roles with 'DLP / Manage DLP rule' permissions.
- Context-Aware Access policies are often managed in Google Cloud, requiring roles like 'BeyondCorp Admin' or Access Context Manager roles.
