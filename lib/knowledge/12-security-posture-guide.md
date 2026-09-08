---
title: CEP Security Posture Assessment Heuristics
articleId: '12'
summary: 'Internal evaluation criteria the agent uses to assess a Chrome Enterprise Premium environment and recommend next steps. Walks through whether the prerequisites (licenses, connectors, SEB extension) are present, whether DLP rules exist, whether they are tuned, and whether they are enforcing. Covers the telemetry dependency (logs require active rules). For agent-internal use only — do not surface labels or framework names to users.'
---

# CEP Security Posture Assessment

These criteria help the agent decide what to recommend after running `diagnose_environment`. They are agent-internal — describe findings to the user in plain language without quoting category names from this article.

## Step 1: Are the prerequisites in place?

Look for missing CEP licenses, unconfigured Content Analysis Connectors, or a missing Secure Enterprise Browser (SEB) extension.

**Directive**: If any prerequisite is missing, the agent MUST recommend closing those gaps before suggesting any DLP rule work or concluding Secure Gateway client configuration. DLP rules cannot scan content while connectors are off, data-masking features depend on the SEB extension, and Zero-Trust browser routing for Secure Gateway applications (both SaaS and private web apps) requires the SEB extension to be force-installed on managed devices. Surface this dependency explicitly; do not list rule recommendations or client policy instructions alongside foundation gaps.

**Remediation Goals**:

1.  **Licenses**: Assign CEP licenses to all managed users.
2.  **Connectors**: Enable and configure all Content Analysis Connectors (Upload, Download, Paste, Print, URL Check) at the Root OU.
3.  **SEB extension**: Force-install the Secure Enterprise Browser extension (ID: `ekajlcmdfcigmdbphhifahdfjbkciflj`) so the environment can use advanced features like data masking and Zero-Trust routing for Secure Gateway applications.

## Step 2: Are there any DLP rules?

If the prerequisites are in place but the environment has zero or very few rules.

**Directive**: The agent MUST analyze the activity log first to anchor any rule recommendations in real-world usage patterns. Security logs for data-centric events typically populate when a rule is active or when "Chrome Security Insights" is enabled. New rules MUST start in `AUDIT` mode; do not propose creating a rule directly in `WARN` or `BLOCK` from this state.

**Diagnostic Steps**:

1.  **Activity-log review first**: Call `get_chrome_activity_log` and report what's in it. If sparse or empty, name that explicitly — this is common when rules are missing and "Chrome Security Insights" is not enabled.
2.  **Pick a deployment style**:
    - **Broad baseline**: Deploy broad `AUDIT`-mode rules (a "starter pack") for a comprehensive view of high-risk data flows.
    - **Incremental discovery**: For organizations with strict change controls, deploy targeted `AUDIT` rules covering known-sensitive domains or specific high-risk detectors first.
3.  **Plan the next review**: Once `AUDIT` logs populate, the agent should re-run the assessment to identify patterns and move on to tuning.

## Step 3: Are the existing rules tuned?

If rules exist but are predominantly in `AUDIT` mode.

**Directive**: The agent MUST prioritize tuning noisy audit-only rules over adding new ones. Before recommending changes, correlate activity log events to specific rules and identify the highest-volume offenders. A rule that fires disproportionately is a false-positive risk, not proof of value.

**Diagnostic Steps**:

1.  **Identify the noisy rule(s)**: Use the activity log to find rules generating a disproportionate share of events. Lead the recommendations with those rules.
2.  **Tighten the noisy rule**: Adjust match thresholds, refine URL categories, or add destination constraints based on observed traffic. Provide a concrete patch (CEL or JSON) when proposing changes.
3.  **Confirm trigger coverage**: After tuning, verify rules cover the relevant triggers (Upload, Paste, Download, Print, URL Check) for the data types in scope.

## Step 4: Are the rules enforcing?

If rules are tuned and high-fidelity (in `WARN` or `BLOCK`, with low false-positive rates).

**Directive**: The agent MUST focus on maintaining enforcement and expanding coverage carefully. Do not recommend new `BLOCK` rules without first staging them in `AUDIT` mode (the safety guardrail in the system prompt enforces this — `BLOCK` rules cannot be created in `ACTIVE` state by the agent). Continuous-audit recommendations take priority over policy expansion.

**Diagnostic Steps**:

1.  **Maintain enforcement**: Keep stable, high-fidelity rules in `WARN` or `BLOCK`. Recommend a weekly review of `BLOCK` events to keep business continuity in view.
2.  **Expand coverage carefully**: When proposing new coverage, stage it in `AUDIT` mode first; promote to `WARN` or `BLOCK` only after the audit logs confirm low false-positive rates.
3.  **Apply data masking**: Implement hard or light obfuscation for sensitive data in the browser for specific URLs where that's appropriate.
