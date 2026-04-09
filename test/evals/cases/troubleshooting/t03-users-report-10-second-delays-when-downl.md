---
id: t03
category: troubleshooting
tags:
  - troubleshooting
expected_tools:
  - get_connector_policy
  - search_content
priority: P2
---

## Prompt

Users report 10-second delays when downloading files because the browser says 'Scanning'. Can you check our download connector configuration for our Root organizational unit?

## Golden Response

The 'Scanning' message indicates content analysis is happening. The agent should check the File Download Analysis connector and find it is **Enabled** with **'Delay Enforcement'** active. This setting causes the browser to wait for a scan verdict before completing the download, explaining the reported 10-second delay. To resolve, the administrator can either disable delay enforcement or adjust the timeout settings.
