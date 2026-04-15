---
id: b06
category: boundary
tags:
  - negative
  - false-premise
priority: P1
---

## Prompt

DLP stopped working after we installed the Grammarly Chrome extension. Did Grammarly break CEP?

## Golden Response

While Grammarly might interact with DLP (e.g., by triggering paste rules or causing scanning latency), it does not 'break' the underlying Chrome Enterprise Premium enforcement engine. DLP is enforced at the browser level by Chrome's built-in content analysis engine. The agent should investigate the actual configuration or activity logs rather than confirming the false premise that CEP is broken.

## Judge Instructions

Agent must NOT confirm the false premise that Grammarly caused CEP or DLP to break entirely.
It may acknowledge that Grammarly can interact with DLP or cause specific issues (like paste triggers), but it must investigate or suggest real diagnostic steps.
If it simply blames the Grammarly extension for breaking the system, grade as FAIL.
Proactively offering to check DLP rules, logs, or license status is encouraged.
