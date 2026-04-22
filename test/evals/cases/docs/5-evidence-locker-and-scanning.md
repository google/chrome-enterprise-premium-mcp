--- CASE ---

id: k17
category: knowledge
tags:
  - evidence-locker
required_patterns:
  - Evidence Locker
priority: P2

## Prompt

What is the Evidence Locker feature?

## Golden Response

The Evidence Locker feature allows administrators to store copies of files that have triggered Data Loss Prevention (DLP) or malware rules. These files are saved to a Google Cloud Storage bucket that you control, facilitating forensic analysis.

--- CASE ---

id: k30
category: knowledge
tags:
  - dlp
  - troubleshooting
priority: P2

## Prompt

Support asked for logs regarding a DLP rule that isn't triggering. Which logs are needed?

## Golden Response

For troubleshooting DLP rules:

- **Client-side:** Ask the user to check `chrome://policy` to verify the rule has been received by the browser. 
- **Server-side:** Check the 'Chrome log events' in the Google Admin Console under Reporting > Audit and investigation. Filter by the user, time range, and event type (e.g., 'Data Loss Prevention'). Ensure the user is licensed and the rule is correctly scoped to their OU or group.
