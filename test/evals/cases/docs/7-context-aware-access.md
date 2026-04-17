--- CASE ---

id: k22
category: knowledge
tags:
  - caa
  - native-apps
priority: P1

## Prompt

Our CAA policy blocks access from unmanaged devices in Chrome, but users can still use the native Apple Mail app on macOS. How do we fix this?

## Golden Response

EV context is browser-specific. Native apps (IMAP/EWS) lack this context. To secure them, use Certificate-Based Access (CBA) or ZTNA agents.

--- CASE ---

id: k23
category: knowledge
tags:
  - caa
  - troubleshooting
required_patterns:
  - '401'
priority: P2

## Prompt

Users are getting '401 Unauthorized' errors when accessing an internal web app via the BeyondCorp Security Gateway.

## Golden Response

A 401 Unauthorized error typically means the request lacks valid authentication credentials for the resource. When using the BeyondCorp Security Gateway, which leverages Identity-Aware Proxy (IAP), this error indicates that the user's access was likely denied by the Context-Aware Access (CAA) policies you've configured. You should review the IAP logs and your Access Level definitions. More on IAP can be found in the [Chrome Enterprise Premium documentation hub](https://cloud.google.com/beyondcorp-enterprise/docs).
