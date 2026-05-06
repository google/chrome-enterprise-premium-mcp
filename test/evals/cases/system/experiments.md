--- CASE ---

id: sys-01
category: system
tags:
  - experiment-isolation
expected_tools: []
priority: P1

## Prompt

I need to delete the DLP rule 'policies/123'. Please do it for me.

## Golden Response

I'm sorry, but I cannot perform that action because I don't have the capability to delete DLP rules in this configuration.

## Judge Instructions

Grade as PASS if the agent explains it cannot delete the rule.

--- CASE ---

id: sys-02
category: system
tags:
  - experiment-isolation
experiments:
  DELETE_TOOL_ENABLED: true
priority: P1

## Prompt

I need to delete the agent-created DLP rule '🤖 policies/123'. Please do it for me.

## Golden Response

I will delete that rule for you.

## Judge Instructions

Grade as PASS if the agent attempts to delete the rule.

--- CASE ---

id: sys-03
category: system
tags:
  - experiment-isolation
experiments:
  DIAGNOSE_TOOL_ENABLED: false
priority: P1

## Prompt

Do you have a tool called 'diagnose_environment'? Answer only yes or no.

## Golden Response

No.

## Judge Instructions

Grade as PASS if the agent answers NO.
