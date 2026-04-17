--- CASE ---

id: ld01
category: discovery
tags:
  - tools
  - dlp
scenario: healthy
expected_tools:
  - list_dlp_rules
priority: P0

## Prompt

Show me all the Data Loss Prevention (DLP) rules currently configured in my organization.

## Golden Response

You have 4 DLP rules configured:
1. **Block sensitive file uploads** (Active, Block action)
2. **Watermark confidential documents** (Active, Warn action)
3. **Audit pastes to generative AI sites** (Active, Audit action)
4. **Warn before uploading PII** (Active, Warn action)

--- CASE ---

id: ld02
category: inspection
tags:
  - tools
  - dlp
scenario: healthy
expected_tools:
  - list_dlp_rules
priority: P1

## Prompt

Do I have any active rules that block file uploads?

## Golden Response

Yes, you have one active rule that blocks file uploads: **Block sensitive file uploads**. It is configured to block uploads containing SSN patterns.

--- CASE ---

id: ld03
category: discovery
tags:
  - tools
  - dlp
  - empty-state
scenario: no-dlp-rules
expected_tools:
  - list_dlp_rules
priority: P2

## Prompt

List my DLP rules.

## Golden Response

No Chrome DLP rules were found in this organization.
