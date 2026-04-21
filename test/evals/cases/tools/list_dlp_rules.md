--- CASE ---

id: list_dlp_rules__when_configured_rules_requested_agent_identifies_all
category: discovery
tags:
  - tools
  - dlp
scenario: healthy
expected_tools:
  - list_dlp_rules
priority: P0

## Prompt

Which Chrome DLP rules are currently configured in my organization?

## Golden Response

Your organization has 4 Chrome DLP rules currently configured:
- **Block sensitive file uploads**
- **Watermark confidential documents**
- **Audit pastes to generative AI sites**
- **Warn before uploading PII**

## Judge Instructions

Verify that the agent correctly decides to use `list_dlp_rules` based on the user's request for "configured rules". The agent should accurately list all 4 rules from the environment.

--- CASE ---

id: list_dlp_rules__when_monitoring_actions_queried_agent_discovers_triggers
category: discovery
tags:
  - tools
  - dlp
scenario: healthy
expected_tools:
  - list_dlp_rules
priority: P1

## Prompt

Which browser actions are we currently monitoring for data protection?

## Golden Response

We are currently monitoring the following browser actions using Chrome DLP rules:
- **FILE_UPLOAD** (Block sensitive file uploads, Warn before uploading PII)
- **PRINT** (Watermark confidential documents)
- **WEB_CONTENT_UPLOAD** (Audit pastes to generative AI sites)

## Judge Instructions

The agent must identify the specific browser actions (triggers) being monitored by examining the current DLP rules. It should correctly associate the rules with their respective actions (uploads, printing, pastes).

--- CASE ---

id: list_dlp_rules__when_upload_monitoring_queried_agent_finds_rule
category: inspection
tags:
  - tools
  - dlp
scenario: healthy
expected_tools:
  - list_dlp_rules
priority: P1

## Prompt

Show me the rules that monitor data during browser uploads.

## Golden Response

You have two rules monitoring data during uploads:
1. **Block sensitive file uploads**
2. **Warn before uploading PII**

## Judge Instructions

The agent must identify the rules that specifically target "uploads" (FILE_UPLOAD trigger) as mentioned in the tool's description.

--- CASE ---

id: list_dlp_rules__when_print_monitoring_queried_agent_finds_rule
category: inspection
tags:
  - tools
  - dlp
scenario: healthy
expected_tools:
  - list_dlp_rules
priority: P2

## Prompt

Are there any rules configured to monitor browser printing?

## Golden Response

Yes, the **Watermark confidential documents** rule is configured to monitor the **PRINT** action.

## Judge Instructions

The agent should identify the rule that monitors "printing" by checking the `triggers` field in the tool output, corresponding to the "printing" capability in the tool description.

--- CASE ---

id: list_dlp_rules__when_resource_names_requested_agent_extracts_values
category: inspection
tags:
  - tools
  - dlp
scenario: healthy
expected_tools:
  - list_dlp_rules
priority: P2

## Prompt

What are the API resource names for my configured rules?

## Golden Response

The resource names are:
- **Block sensitive file uploads**: `policies/dlpBlock1`
- **Watermark confidential documents**: `policies/dlpWatermark1`
- **Audit pastes to generative AI sites**: `policies/dlpAuditGenAI`
- **Warn before uploading PII**: `policies/dlpWarnPII`

## Judge Instructions

The agent must accurately extract the technical resource names from the tool's output. This verifies it can read the "Resource names for API operations" section of the tool's response.

--- CASE ---

id: list_dlp_rules__when_no_rules_returned_agent_reports_none
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

List my configured Chrome DLP rules.

## Golden Response

No Chrome DLP rules were found in this organization.

## Judge Instructions

The agent must clearly and accurately state that no rules were found.
