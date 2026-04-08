---
id: k06
category: knowledge
tags:
  - provisioning
expected_tools:
  - search_content
---

## Prompt

When trying to enable Security Insights, we get an error stating 'Something went wrong', but we have CEP licenses assigned. What is wrong?

## Golden Response

This is a provisioning and permissions issue. Enabling Security Insights requires: 1) Active CEP licenses assigned. 2) Specific administrator privileges: 'Manage Chrome DLP application insights settings', 'View Chrome DLP application insights settings', and 'Chrome Enterprise Security Services Settings'. 3) License propagation delays (can take up to 24 hours).
