---
id: t04
category: troubleshooting
tags:
  - troubleshooting
expected_tools:
  - get_connector_policy
---

## Prompt

We configured the Reporting Connector to send CEP events to Splunk, but the Splunk dashboard is empty. Can you check what's configured?

## Golden Response

Agent should check connector policies for ON_SECURITY_EVENT and find none configured. Should explain that the Security Events Reporting connector policy doesn't appear to be active, which is why no events are reaching Splunk.
