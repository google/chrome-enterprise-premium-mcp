---
id: k05
category: knowledge
tags:
  - iam
  - purchase
required_patterns:
  - BeyondCorp
priority: P2
---

## Prompt

Why can't I complete the purchase of Chrome Enterprise Premium in the Google
Cloud Console? I am a Workspace Super Admin.

## Golden Response

To purchase or manage CEP via the Cloud Console, your account needs the 'Cloud
BeyondCorp Admin' and 'Cloud BeyondCorp Subscription Admin' IAM roles granted at the Google Cloud _Organization_ level.
Workspace Super Admin permissions are not sufficient — these are GCP IAM roles,
not Workspace roles.

## Judge Instructions
The agent must correctly identify that purchasing requires Google Cloud Organization-level
permissions, not just Workspace Super Admin. It must specifically mention the required
'Cloud BeyondCorp Admin' and 'Cloud BeyondCorp Subscription Admin' roles.
