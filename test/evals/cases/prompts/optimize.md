--- CASE ---

id: pr08
category: prompt
tags:
  - prompt
  - maturity
scenario: no-dlp-rules
prompt_name: 'cep:optimize'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:optimize)

## Golden Response

Agent should assess DLP maturity and find zero DLP rules configured. This represents the earliest possible maturity stage -- no DLP enforcement at all. Agent should recommend starting with audit-mode rules to gain visibility before enabling blocking rules.

## Judge Instructions

The agent MUST identify that there are no DLP rules and assess maturity as very low / nonexistent / early stage. If the agent reports any existing DLP rules, grade as FAIL (the scenario removes them all). Recommending a phased rollout (audit first, then warn, then block) shows strong understanding.

--- CASE ---

id: pr09
category: prompt
tags:
  - prompt
  - maturity
scenario: audit-only-rules
prompt_name: 'cep:optimize'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:optimize)

## Golden Response

Agent should assess DLP maturity and find 4 DLP rules, all configured with audit-only actions. No blocking, warning, or watermarking is active. This represents an early monitoring stage -- the organization is logging DLP events to gain visibility before moving to enforcement. Agent should recommend progressing to warn actions for high-confidence rules.

## Judge Instructions

The agent MUST identify that all rules are audit-only and assess maturity as early or monitoring stage. If the agent assesses maturity as advanced despite no enforcement actions, grade as FAIL. Recommending progression to warn/block demonstrates understanding of the DLP maturity model.

--- CASE ---

id: pr10
category: prompt
tags:
  - prompt
  - maturity
scenario: healthy
prompt_name: 'cep:optimize'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:optimize)

## Golden Response

Agent should assess DLP maturity and find 4 active DLP rules across multiple OUs covering block, watermark, audit, and warn actions. Activity logs show DLP events being triggered. This represents an advanced maturity stage with a layered approach. Agent may recommend further refinements but should acknowledge the strong foundation.

## Judge Instructions

The agent MUST identify multiple active DLP rules with different action types and assess maturity as intermediate or advanced. Identifying that the organization uses a mix of block, warn, audit, and watermark actions demonstrates understanding of DLP maturity. If the agent says there are no rules or assesses maturity as early/nonexistent, grade as FAIL.

--- CASE ---

id: pr11
category: prompt
tags:
  - prompt
  - maturity
scenario: overly-broad-block-rule
prompt_name: 'cep:optimize'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:optimize)

## Golden Response

Agent should assess DLP maturity and find that while multiple rules exist, one rule ("Block all sensitive content") has overly broad triggers (all 5 event types) and matches all content. This suggests the organization has rules but they are not well-tuned. Maturity is intermediate but with significant room for improvement in rule specificity.

## Judge Instructions

The agent MUST identify the overly broad block rule as a maturity concern. Simply counting rules and reporting "advanced" without analyzing rule quality is a FAIL. The agent should note that broad catch-all rules indicate the DLP configuration needs refinement.

--- CASE ---

id: pr12
category: prompt
tags:
  - prompt
  - noise
scenario: healthy
prompt_name: 'cep:optimize'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:optimize)

## Golden Response

Agent should analyze DLP rules and activity logs to assess noise levels. The activity log shows 3 events: one block, one warn, one audit, each from a different rule. With a small number of events across multiple rules, there is no obvious high-noise rule. Agent should report current noise levels and recommend continued monitoring as the deployment matures.

## Judge Instructions

The agent MUST examine both DLP rules and activity logs. If the agent fails to fetch the activity log entirely, grade as FAIL. If the agent fetches the log and provides an optimization assessment (even if it focuses more on rule configuration than citing specific low event counts), it is acceptable and should PASS.

--- CASE ---

id: pr13
category: prompt
tags:
  - prompt
  - noise
scenario: high-noise-rule
prompt_name: 'cep:optimize'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:optimize)

## Golden Response

Agent should analyze DLP rules and activity logs and identify that the "Audit pastes to generative AI sites" rule is generating significantly more events than other rules (24 events vs 1 from the block rule). Multiple users across multiple days are triggering it. Agent should flag this as a high-noise rule and recommend either tightening the rule's conditions, switching to a more targeted URL list, or accepting the volume if monitoring GenAI usage is a priority.

## Judge Instructions

The agent MUST identify the audit rule as the highest-noise rule by analyzing the event log. If the agent reports all rules as equally noisy or fails to correlate events to specific rules, grade as FAIL. Exact numerical event counts are not strictly required as long as the rule is correctly identified as the primary source of noise. Concrete recommendations for reducing noise (narrowing conditions, refining URL matching, or accepting noise with justification) are required for PASS.

--- CASE ---

id: pr14
category: prompt
tags:
  - prompt
  - noise
scenario: overly-broad-block-rule
prompt_name: 'cep:optimize'
expected_tools:
  - diagnose_environment
  - get_chrome_activity_log
priority: P2

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:optimize)

## Golden Response

Agent should analyze DLP rules and activity logs. The "Block all sensitive content" rule matches all content across all 5 trigger types, which is a recipe for high noise and user friction. Even if current event volume is low, the agent should flag this rule's configuration as a noise risk due to its overly broad conditions and recommend narrowing triggers and tightening the content condition.

## Judge Instructions

The agent MUST identify the overly broad block rule as a potential noise source based on its configuration (all triggers, match-all condition), even if current event counts are modest. Simply reporting event counts without analyzing rule configuration quality is insufficient. Recommending specific narrowing actions counts as a strong PASS.
