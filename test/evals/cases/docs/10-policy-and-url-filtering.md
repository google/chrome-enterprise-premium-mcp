--- CASE ---

id: k26
category: knowledge
tags:
  - url-filtering
priority: P2

## Prompt

How do I properly use wildcards when configuring URL filtering policies in CEP?

## Golden Response

When configuring URL filtering policies in Chrome Enterprise Premium, the wildcard usage is as follows:

- `example.com`: This will match `example.com` and all its subdomains (e.g., `www.example.com`, `app.example.com`).
- `.example.com`: Use this syntax to match _only_ the exact domain `example.com` and NOT its subdomains.
- `*`: This acts as a general wildcard, often used for matching any URL in certain policy contexts, but should be used carefully to avoid unintended blocking or allowing.

--- CASE ---

id: k27
category: knowledge
tags:
  - policy
  - verification
required_patterns:
  - 'chrome://policy'
priority: P1

## Prompt

How can administrators verify that a browser is actually receiving the correct security policies?

## Golden Response

Use `chrome://policy` on the endpoint.

--- CASE ---

id: k29
category: knowledge
tags:
  - policy
  - gpo
required_patterns: []
priority: P2

## Prompt

We set a cloud policy to block an extension, but `chrome://policy` shows it's allowed with the source 'Platform'.

## Golden Response

Local 'Platform' policies (e.g., from GPO on Windows, Configuration Profiles on macOS) take precedence over Cloud policies by default. You can change this behavior by enabling the '[CloudPolicyOverridesPlatformPolicy](https://chromeenterprise.google/policies/#CloudPolicyOverridesPlatformPolicy)' policy. The default policy precedence is also discussed in the Recommended CEP Settings for a POV document.

--- CASE ---

id: k31
category: knowledge
tags:
  - safe-browsing
required_patterns:
  - SafeBrowsingAllowlistDomains
priority: P1

## Prompt

Safe Browsing is blocking a legitimate internal site, showing a red warning screen. How do we bypass this?

## Golden Response

To prevent Safe Browsing from blocking a legitimate internal site, add the domain to the '[SafeBrowsingAllowlistDomains](https://chromeenterprise.google/policies/#SafeBrowsingAllowlistDomains)' policy in the Google Admin Console.
