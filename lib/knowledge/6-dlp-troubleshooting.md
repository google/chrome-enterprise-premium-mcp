---
title: 'Chrome Data Loss Prevention (DLP) Troubleshooting'
kind: curated
articleType: curated-guide
articleId: 6
---

# Troubleshooting Data Loss Prevention (DLP) Rules

Administrators can use internal Chrome debug pages and Admin Console logs to diagnose DLP issues.

## Troubleshooting DLP Watermarks and Rules

When troubleshooting a non-working watermark, verify that the DLP rule is configured on a supported trigger type, specifically the **URL visited** trigger. Watermarks on other triggers are not supported and will fail to apply.

## Refining Strict DLP Rules

If a strict DLP rule is blocking legitimate uploads to a partner portal, refine by adding the partner domain to Exclude URLs, or changing action to Warn. For testing, rules can be set to **'audit only'** mode, which logs violations without impacting the user. Furthermore, a **custom user message** can be configured to provide more context when an action is blocked or warned.

## Locating Diagnostic Logs

When troubleshooting a failing DLP rule, collect logs from two locations: **1) Client-side:** On the user's machine, navigate to chrome://safe-browsing/#tab-reporting to check for locally logged events, which can show if the browser detected an action. **2) Server-side:** In the Google Admin Console, go to **Reporting > Audit and investigation > Chrome log events**. Filter by the user and time to see if the event was reported to the backend, which confirms policy evaluation.
