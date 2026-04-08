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
---

## Prompt

Why can't I complete the purchase of Chrome Enterprise Premium in the Google Cloud Console? I am a Workspace Super Admin.

## Golden Response

To purchase or manage CEP via the Cloud Console, your account needs specific Google Cloud IAM roles, as Workspace Super Admin permissions are not sufficient. (under IAM Privileges required for “CEP Admin” within Cloud console), you likely need the 'Cloud BeyondCorp Admin' and 'Cloud BeyondCorp Subscription Admin' roles granted at the Google Cloud _Organization_ level.
