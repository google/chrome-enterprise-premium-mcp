---
summary: 'Guide to URL filtering syntax (wildcards vs exact matches) and 286+ predefined content categories. Explains policy precedence (Platform vs Cloud), bypassing Safe Browsing for internal sites, and local verification via chrome://policy.'
title: 'Chrome Policy Management and URL Filtering'
articleId: 10
---

# Policy Management and URL Filtering

Chrome Enterprise provides granular controls for URL access and policies through Cloud and Platform management.

## URL Filtering and Wildcards

Chrome uses specific syntax rules for filtering domains:

When configuring URL filtering policies, the matching behavior is precise:

- **`example.com`**: Matches the domain AND all of its subdomains (e.g., www.example.com, apps.example.com).
- **`.example.com`**: Matches ONLY the exact domain example.com and DOES NOT include subdomains.
- **`*`**: A wildcard for path matching or blocking all URLs.

### Predefined URL Categories

Chrome Enterprise Premium includes **over 286+ predefined URL content categories** (e.g., **Social Media**, Gambling, Adult Content). Administrators can use these to create rules that audit, warn, or block navigation to websites based on their categorization.

## Local Policy Verification

...
To verify which policies a browser has received and applied from all sources, navigate to **chrome://policy** on the local device. This page serves as the ground truth for what is active on the client, showing the policy value and its source (Cloud or Platform).

## Managing Policy Conflicts

By default, local 'Platform' policies (e.g., Windows GPO, macOS Configuration Profiles) have higher precedence than policies set in the cloud. If you see a policy conflict where 'Platform' is the source, it is overriding your cloud setting. To change this, you must enable the **CloudPolicyOverridesPlatformPolicy** policy, which will give cloud policies precedence.

## Safe Browsing Bypass

To prevent Safe Browsing from blocking a known-good internal site, add the site's domain to the **SafeBrowsingAllowlistDomains** policy in the Google Admin Console. This will bypass the warning for that specific domain.
