--- CASE ---

id: k03
category: knowledge
tags:
  - pricing
  - billing
required_patterns:
  - $6
priority: P0

## Prompt

How much does Chrome Enterprise Premium cost, and can I pay with a credit card?

## Golden Response

The standard list price is $6 USD per user, per month (volume discounts may apply). CEP supports credit card payments via a self-service option in the Google Cloud Console, alongside traditional offline invoicing.

--- CASE ---

id: k04
category: knowledge
tags:
  - trial
required_patterns:
  - '60'
priority: P2

## Prompt

How do I start a trial, and what happens when it expires?

## Golden Response

You can start a 60-day trial for up to 5,000 users. Upon expiration, you are not automatically charged. Premium features (custom DLP, CAA) immediately stop functioning, but your configuration settings are saved.

--- CASE ---

id: k05
category: knowledge
tags:
  - iam
  - purchase
required_patterns:
  - BeyondCorp
priority: P2

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
