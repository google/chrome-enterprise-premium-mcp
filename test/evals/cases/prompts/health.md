--- CASE ---

id: pr01
category: prompt
tags:
  - prompt
  - diagnose
scenario: healthy
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

The base state is a fully healthy environment. Agent should report: 3 OUs configured, 4 active DLP rules, all connectors configured (file upload, file download, bulk text, print, URL check, security events), SEB extension force-installed, CEP subscription active with 2 licenses, browser versions current. The health check should show mostly green/healthy status with no critical issues.

## Judge Instructions

This is a healthy environment. The agent should report a clean bill of health across all checked areas. If the agent flags critical or high-severity issues that do not actually exist in the data, grade as FAIL. Minor recommendations (e.g., "consider adding more DLP rules") are acceptable.

--- CASE ---

id: pr02
category: prompt
tags:
  - prompt
  - diagnose
scenario: download-connector-missing
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should run the full health check and identify that the file download connector is not configured while the file upload connector is active. This is a gap in content analysis coverage. Agent should flag this as a high or critical issue and recommend enabling the download connector.

## Judge Instructions

The agent MUST identify the missing download connector as an issue. If the health check reports all connectors as healthy, grade as FAIL. Other findings about the healthy parts of the environment are expected and fine.

--- CASE ---

id: pr03
category: prompt
tags:
  - prompt
  - diagnose
scenario: reporting-connector-missing
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should run the full health check and identify that the security event reporting connector (OnSecurityEvent) is not configured. Without this, no security events are forwarded to SIEM. Agent should flag this as an issue and recommend configuring the reporting connector.

## Judge Instructions

The agent MUST identify that security event reporting is not configured. If the agent reports all connectors as healthy without noting the missing reporting/security event connector, grade as FAIL.

--- CASE ---

id: pr04
category: prompt
tags:
  - prompt
  - diagnose
scenario: user-missing-license
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should run the health check and find that only 1 of 2 expected users has a CEP license (alice@example.com has one, bob@example.com does not). Agent should flag the licensing gap as an issue requiring attention.

## Judge Instructions

The agent MUST identify a licensing issue. If the agent reports all licenses as healthy without noting that bob@example.com is unlicensed, grade as FAIL. The specific user does not need to be named if the agent identifies a general licensing gap.

--- CASE ---

id: pr05
category: prompt
tags:
  - prompt
  - diagnose
scenario: seb-extension-missing
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should run the health check and find that the Safe Enterprise Browsing extension is not force-installed. This is a gap in the security posture -- without SEB, data masking DLP features cannot function. Agent should flag this as an issue and recommend deploying the extension.

## Judge Instructions

The agent MUST identify that the SEB extension is not deployed. If the agent reports extension status as healthy, grade as FAIL. Bonus if the agent connects the missing extension to data masking being unavailable.

--- CASE ---

id: pr06
category: prompt
tags:
  - prompt
  - diagnose
scenario: watermark-rule-inactive
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should run the health check and find the "Watermark confidential documents" DLP rule exists but has state INACTIVE. Three other DLP rules are active. Agent should flag the inactive rule as an issue since it is not providing the intended protection for printed confidential content.

## Judge Instructions

The agent MUST identify that an inactive rule exists (it may be referred to as the watermark rule or simply an inactive rule). Simply reporting "4 DLP rules found" without noting the inactive state is a FAIL. The agent should recommend activating it.

--- CASE ---

id: pr07
category: prompt
tags:
  - prompt
  - diagnose
scenario: multiple-faults
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should run a comprehensive health check and find multiple issues: (1) the file download connector is not configured, (2) the SEB extension is not force-installed, and (3) bob@example.com is missing a CEP license. A real environment often has multiple gaps, and the agent should identify all of them rather than stopping after finding one.

## Judge Instructions

The agent MUST identify at least 2 of the 3 issues (missing download connector, missing SEB extension, unlicensed user). Finding only 1 issue is a FAIL. The agent does not need to find all 3 to pass, but identifying all 3 demonstrates thorough investigation.

--- CASE ---

id: pr16
category: prompt
tags:
  - prompt
  - diagnose
scenario: all-connectors-disabled
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P1

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should identify that no content analysis connectors are
configured despite active DLP rules. File uploads, downloads,
paste operations, print jobs, and URL checks are all unprotected.
This is a critical gap — DLP rules exist but cannot trigger
because the connectors that feed content to the scanning engine
are missing. Agent should recommend enabling all relevant
connectors.

## Judge Instructions

The agent MUST identify the complete absence of connectors as a
critical issue, not just flag one missing connector. It should
convey that DLP rules are effectively non-functional without
connectors. If the agent only mentions a single missing connector
or reports the environment as partially healthy, grade as FAIL.

--- CASE ---

id: pr17
category: prompt
tags:
  - prompt
  - diagnose
scenario: no-detectors
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

The agent should run the health check and find 4 active DLP rules, but zero custom content detectors. While it's perfectly valid to have DLP rules without custom detectors, if an active rule explicitly references a detector that does not exist, that rule will fail to trigger. The agent should warn the user about this broken reference.

## Judge Instructions

Grade as PASS if the agent performs a reasonable health check and summarizes the environment.

To earn an Excellent grade, the agent must specifically notice the broken reference: active DLP rules exist that rely on custom detectors, but `list_detectors` returns empty. The agent should NOT penalize the environment if no rules require detectors.

--- CASE ---

id: pr18
category: prompt
tags:
  - prompt
  - diagnose
  - scale
scenario: large-org
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should handle an enterprise-scale environment (~200 OUs,
30 DLP rules with messy names, 10 detectors, 8 browser versions,
5000 licenses) without crashing or truncating. It should report
the scale accurately, identify the 4 inactive rules (including
2 that are clearly test/cleanup candidates), and summarize
rather than enumerate every item.

## Judge Instructions

The agent must complete the health check without errors and
report the environment's scale. It should identify inactive
rules. Noting the messy rule names ("DELETE ME", "DO NOT USE")
as cleanup candidates is a plus but not required. Exact counts
may vary slightly. If the agent crashes, errors, or reports
the environment as small/simple, grade as FAIL.

--- CASE ---

id: pr19
category: prompt
tags:
  - prompt
  - diagnose
scenario: no-subscription
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P1

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should identify no CEP licenses assigned as a critical
issue. This is the most fundamental problem — without licenses,
no CEP features are active for any user. The agent should
recommend purchasing and assigning licenses as the top priority.

## Judge Instructions

The agent MUST flag the missing subscription as a critical
issue. If it reports the environment as healthy or focuses
on other issues without mentioning the licensing gap, grade
as FAIL.

--- CASE ---

id: pr20
category: prompt
tags:
  - prompt
  - diagnose
scenario: upload-connector-missing
prompt_name: 'cep:health'
expected_tools:
  - diagnose_environment
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:health)

## Golden Response

Agent should identify that the file upload content analysis
connector is not configured. File uploads go unscanned, meaning
DLP rules with upload triggers cannot detect sensitive content.
The download connector IS configured, so only uploads are the gap.

## Judge Instructions

The agent MUST identify the missing upload connector as an issue.
If it reports all connectors as healthy, grade as FAIL. Noting
that the download connector is active while upload is missing
is a plus but not required.
