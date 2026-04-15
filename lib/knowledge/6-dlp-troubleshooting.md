---
summary: 'Troubleshooting for DLP rules and watermarks. Guides on refining strict rules (Audit mode, Exclude URLs) and locating diagnostic logs at chrome://safe-browsing and in the Admin Console.'
title: 'Chrome Data Loss Prevention (DLP) Troubleshooting'
articleId: 6
---

# Troubleshooting Data Loss Prevention (DLP) Rules

Administrators can use internal Chrome debug pages and Admin Console logs to diagnose DLP issues.

## Troubleshooting DLP Watermarks and Rules

When troubleshooting a non-working watermark, verify that the [DLP rule](4-dlp-core-features.md) is configured on a supported trigger type with valid [CEL syntax](11-dlp-cel-syntax.doc.js), specifically the **URL visited** trigger. Watermarks on other triggers are not supported and will fail to apply.

## Refining Strict DLP Rules

If a strict DLP rule is blocking legitimate uploads to a partner portal, refine by adding the partner domain to Exclude URLs, or changing action to Warn. For testing, rules can be set to **'audit only'** mode, which logs violations without impacting the user. Furthermore, a **custom user message** can be configured to provide more context when an action is blocked or warned.

## Locating Diagnostic Logs

When troubleshooting a failing DLP rule, collect logs from two locations: **1) Client-side:** On the user's machine, navigate to chrome://safe-browsing/#tab-reporting to check for locally logged events, which can show if the browser detected an action. **2) Server-side:** In the Google Admin Console, go to **Reporting > Audit and investigation > Chrome log events**. Filter by the user, time, and event type (e.g., 'Data Loss Prevention') to see if the event was reported to the backend, which confirms policy evaluation. Additionally, always ensure the user has an active CEP license and the DLP rule is correctly scoped to their Organizational Unit (OU) or group.
