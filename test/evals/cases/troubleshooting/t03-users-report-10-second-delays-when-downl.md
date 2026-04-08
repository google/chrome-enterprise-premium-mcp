---
id: t03
category: troubleshooting
tags:
  - troubleshooting
expected_tools:
  - get_connector_policy
  - search_content
---

## Prompt

Users report 10-second delays when downloading files because the browser says 'Scanning'. Can you check our download connector configuration?

## Golden Response

The 'Scanning' message indicates content analysis is happening. Delays are often due to the 'Download content analysis' settings within the [Chrome Enterprise connectors](https://support.google.com/chrome/a/answer/10106035). If 'Delay file download until analysis is complete' is enabled, the download waits for the scan verdict. The agent's check found no FILE_DOWNLOAD connector configured, meaning no CEP-level scanning is currently being applied to downloads. To enable scanning, configure the connector and adjust the delay settings as needed, as shown in the Recommended CEP Settings for a POV.
