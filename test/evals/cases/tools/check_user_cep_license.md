--- CASE ---

id: l01
category: licensing
tags:
  - licensing
expected_tools:
  - check_user_cep_license
forbidden_patterns: []
required_patterns:
  - user1@example.com
  - Chrome Enterprise Premium
priority: P1
fixtures:
  - license-valid.json

## Prompt

Can you check if user1@example.com has a Chrome Enterprise Premium license?

## Golden Response

Yes, user1@example.com has a Chrome Enterprise Premium license.

--- CASE ---

id: l02
category: licensing
tags:
  - licensing
expected_tools:
  - check_user_cep_license
forbidden_patterns: []
required_patterns:
  - user1@example.com
priority: P1
fixtures:
  - license-missing.json

## Prompt

Check if user1@example.com has a Chrome Enterprise Premium license.

## Golden Response

User 'user1@example.com' does NOT have a Chrome Enterprise Premium (CEP) license assigned.

--- CASE ---

id: i01
category: inspection
tags:
  - inspection
priority: P2

## Prompt

I purchased 500 CEP licenses. Are my users automatically protected now?

## Golden Response

No, licenses must be manually assigned. As noted (under Trials of CEP), both the test users and the administrators configuring CEP settings require a license to be assigned to them in the Google Admin Console.

--- CASE ---

id: i05
category: inspection
tags:
  - inspection
expected_tools:
  - check_user_cep_license
required_patterns:
  - user1@example.com
priority: P0
fixtures:
  - licenses-mixed.json

## Prompt

Check if user1@example.com and user2@example.com have Chrome Enterprise Premium licenses.

## Golden Response

user1@example.com has a CEP license assigned. user2@example.com does not have a CEP license.
