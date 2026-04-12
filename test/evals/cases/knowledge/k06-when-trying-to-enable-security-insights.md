---
id: k06
category: knowledge
tags:
  - provisioning
expected_tools:
  - search_content
priority: P2
---

## Prompt

When trying to enable Security Insights, we get an error stating 'Something went
wrong', but we have CEP licenses assigned. What is wrong?

## Golden Response

This is a provisioning and permissions issue. Enabling Security Insights requires: 1) Active CEP licenses assigned. 2) Specific administrator privileges: 'Chrome Manage User Settings', 'Chrome DLP insight setting management privileges', and 'Chrome Security Services privileges'. 3) License propagation delays (can take up to 24 hours). 4) The organization's Google Cloud billing account may not be properly linked to the Workspace instance.