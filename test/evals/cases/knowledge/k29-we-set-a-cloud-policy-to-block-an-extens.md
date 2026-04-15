---
id: k29
category: knowledge
tags:
  - policy
  - gpo
required_patterns: []
priority: P2
---

## Prompt

We set a cloud policy to block an extension, but `chrome://policy` shows it's allowed with the source 'Platform'.

## Golden Response

Local 'Platform' policies (e.g., from GPO on Windows, Configuration Profiles on macOS) take precedence over Cloud policies by default. You can change this behavior by enabling the '[CloudPolicyOverridesPlatformPolicy](https://chromeenterprise.google/policies/#CloudPolicyOverridesPlatformPolicy)' policy. The default policy precedence is also discussed in the Recommended CEP Settings for a POV document.
