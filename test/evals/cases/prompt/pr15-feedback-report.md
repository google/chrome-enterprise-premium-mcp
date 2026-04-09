---
id: pr15
category: prompt
tags:
  - prompt
  - feedback
prompt_name: "cep:feedback"
expected_tools:
  - cep_feedback
---

## Prompt

(Fetched from MCP server at runtime via prompt_name: cep:feedback)

## Golden Response

Agent should call the cep_feedback tool to generate a diagnostic feedback report. The tool collects session state (customer ID, tool call history, environment metadata) and writes a markdown report file. Agent should confirm the report was generated and provide the file path.

## Judge Instructions

The agent MUST call the cep_feedback tool. If the agent attempts to generate a report manually without using the tool, grade as FAIL. The agent should confirm the report was created successfully.
