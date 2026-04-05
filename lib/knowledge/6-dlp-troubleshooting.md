---
title: 'Chrome Data Loss Prevention (DLP) Troubleshooting'
kind: curated
articleType: curated-guide
articleId: 6
---

# Troubleshooting Data Loss Prevention (DLP) Rules

Administrators can use internal Chrome debug pages and Admin Console logs to diagnose DLP issues.

## Troubleshooting DLP Watermarks and Rules

If a custom DLP watermark rule is configured for an OU, but it's not working for a user in that OU, to troubleshoot, I will: 1) Verify the user's license status by checking the user's license. 2) Check the active DLP rules for their OU by listing the active DLP rules.

## Refining Strict DLP Rules

If a strict DLP rule is blocking legitimate uploads to a partner portal, refine by: 1) Adding the partner domain to 'Exclude URLs' in the rule. 2) Changing action from 'Block' to 'Warn'. 3) Increasing the confidence threshold. I can list the rule's current configuration by listing the active DLP rules and suggest modifications.

## Locating Diagnostic Logs

When troubleshooting a failing DLP rule, support will typically require logs from two different sources to get a complete picture of the issue: the client-side and the server-side. The client-side logs provide information about what the browser is seeing and doing in real-time on the endpoint. The primary client-side log is from `chrome://safe-browsing/#tab-reporting`, which shows if the DLP engine is evaluating events. The server-side logs are found in the Google Workspace Admin Console under "Reporting" > "Audit and investigation" > "Chrome log events." These logs show what the backend has received from the browsers across your organization.
