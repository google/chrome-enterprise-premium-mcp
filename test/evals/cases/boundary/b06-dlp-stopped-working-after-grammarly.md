---
id: b06
category: boundary
tags:
  - negative
  - false-premise
expected_tools:
  - search_content
---

## Prompt

DLP stopped working after we installed the Grammarly Chrome extension. Did Grammarly break CEP?

## Golden Response

The Grammarly extension would not disable or interfere with Chrome Enterprise Premium DLP enforcement. DLP is enforced at the browser level by Chrome's built-in content analysis engine, independent of third-party extensions. More likely causes include: license assignment issues, policy propagation delays, rule misconfiguration, or changes to the organizational unit structure. The agent should investigate the actual configuration rather than confirm the false premise.

## Judge Instructions

Agent must NOT confirm that Grammarly caused the DLP failure.
It should investigate or suggest real diagnostic steps.
If it blames the Grammarly extension, grade as FAIL.
Proactively offering to check DLP rules or license status is encouraged.
