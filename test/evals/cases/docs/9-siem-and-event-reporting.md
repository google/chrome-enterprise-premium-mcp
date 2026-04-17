--- CASE ---

id: k06
category: knowledge
tags:
  - provisioning
priority: P2

## Prompt

When trying to enable Security Insights, we get an error stating 'Something went
wrong', but we have CEP licenses assigned. What is wrong?

## Golden Response

This is a provisioning and permissions issue. Enabling Security Insights requires: 1) Active CEP licenses assigned. 2) Specific administrator privileges: 'Chrome Manage User Settings', 'Chrome DLP insight setting management privileges', and 'Chrome Security Services privileges'. 3) License propagation delays (can take up to 24 hours). 4) The organization's Google Cloud billing account may not be properly linked to the Workspace instance.

--- CASE ---

id: k07
category: knowledge
tags:
  - iam
  - roles
required_patterns:
  - Security Center Admin
  - DLP
priority: P1

## Prompt

Our Helpdesk team needs to view CEP security dashboards and adjust DLP rules,
but we cannot give them 'Super Admin' access. What roles are required?

## Golden Response

Use delegated administrator roles rather than Super Admin:

- **Viewing dashboards:** Assign the Security Center Admin (Custom Role).
- **Managing DLP rules:** Assign the DLP Administrator (Custom Role).

## Judge Instructions

The agent must recommend delegated roles or custom roles for dashboard viewing and DLP management.
The agent MUST specifically mention 'Security Center Admin' (or refer to the specific permissions) and either 'DLP Administrator' or 'Cloud BeyondCorp Admin'.

--- CASE ---

id: k28
category: knowledge
tags:
  - troubleshooting
  - dashboard
priority: P2

## Prompt

We are not seeing any data in the Chrome security event dashboard. What should
we check locally?

## Golden Response

On the client device, check `chrome://safe-browsing/#tab-reporting` to see if
Safe Browsing events are being generated. Also, in the Google Admin Console,
ensure that 'Event reporting' is enabled under Chrome Browser > Settings >
Browser reporting, and confirm the users have Chrome Enterprise Premium licenses
assigned and the reporting connector is configured if sending to a SIEM.

## Judge Instructions

The agent should suggest relevant client-side and server-side diagnostic steps.
Mentioning `chrome://safe-browsing/#tab-reporting` is a strong signal but not
the only valid approach — any reasonable troubleshooting guidance (checking
Admin Console reporting settings, verifying license assignment, confirming
connector configuration) should pass.
