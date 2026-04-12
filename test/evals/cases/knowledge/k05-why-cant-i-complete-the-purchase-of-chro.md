---
id: k05
category: knowledge
tags:
  - iam
  - purchase
expected_tools:
  - search_content
required_patterns:
  - BeyondCorp
priority: P2
---

## Prompt

Why can't I complete the purchase of Chrome Enterprise Premium in the Google
Cloud Console? I am a Workspace Super Admin.

## Golden Response

To purchase or manage CEP via the Cloud Console, your account needs the 'Cloud
BeyondCorp Admin' IAM role granted at the Google Cloud _Organization_ level.
Workspace Super Admin permissions are not sufficient — this is a GCP IAM role,
not a Workspace role.
