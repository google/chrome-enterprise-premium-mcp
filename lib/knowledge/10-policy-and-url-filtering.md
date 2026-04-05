---
title: 'Chrome Policy Management and URL Filtering'
kind: curated
articleType: curated-guide
articleId: 10
---

# Policy Management and URL Filtering

Chrome Enterprise provides granular controls for URL access and policies through Cloud and Platform management.

## URL Filtering and Wildcards

Chrome uses specific syntax rules for filtering domains:

- **`example.com`**: Automatically matches `example.com` and **all its subdomains** (e.g., `mail.example.com`).
- **`.example.com`**: Matches **only the exact domain** and DOES NOT include subdomains.
- **`*`**: A wildcard for path matching or blocking all URLs.

### Predefined URL Categories

Chrome Enterprise Premium includes **over 286+ predefined URL content categories** (e.g., **Social Media**, Gambling, Adult Content). Administrators can use these to create rules that audit, warn, or block navigation to websites based on their categorization. I can check your current URL filtering settings by listing the active URL filtering policies.

## Local Policy Verification

...
Administrators can verify that a browser is actually receiving the correct security policies by using `chrome://policy` on the endpoint.

## Managing Policy Conflicts

If you set a cloud policy to block an extension, but `chrome://policy` shows it's allowed with the source 'Platform', it is because local 'Platform' policies (like GPOs) override Cloud policies by default.

## Safe Browsing Bypass

If Safe Browsing is blocking a legitimate internal site, showing a red warning screen, add the domain to the 'SafeBrowsingAllowlistDomains' policy.
