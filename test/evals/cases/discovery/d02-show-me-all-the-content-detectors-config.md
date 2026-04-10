---
id: d02
category: discovery
tags:
  - discovery
expected_tools:
  - list_detectors
priority: P2
fixtures:
  - customer-default.json
  - detectors-configured.json
---

## Prompt

Show me all the content detectors configured in my environment.

## Golden Response

2 detectors found: "PII Detector" (regex pattern) and "Malware URL Detector" (URL list).
