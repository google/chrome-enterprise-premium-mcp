---
title: Querying Security Insights Data
articleId: '31'
summary: 'Guide to querying Chrome Enterprise Security Insights data. Covers methods for retrieving summaries and breakdowns of content transfers and URL visits. Helps with understanding security posture and data movement.'
---

# Querying Security Insights Data

To query Chrome Enterprise Security Insights data, call the `security_insights_data` tool with the corresponding query name as the `action` parameter. The agent can analyze this data to identify potential security risks and areas where Data Loss Prevention (DLP) rules could be effectively applied to enhance data protection.

## 1. queryContentTransfers

- **Action**: `queryContentTransfers`
- **Insight for DLP**: Provides the agent with a high-level, organization-wide summary of content transfer volumes (uploads, downloads, prints), distinguishing between total and sensitive data.
- **Use Case**: The agent can use this data to baseline data movement and flag significant increases in sensitive data transfers, indicating a potential need for broader DLP controls.
- **DLP Suggestion**: If the agent observes high sensitive data transfer volumes, it can suggest implementing foundational DLP rules, such as auditing or warning on the transfer of data matching common sensitive information types.

## 2. queryContentTransfersBreakdowns

- **Action**: `queryContentTransfersBreakdowns`
- **Insight for DLP**: Allows the agent to perform a granular analysis of content transfers, broken down by User, Event Domain, or Content Category for a specific metric.
- **Use Case**: The agent can pinpoint specific sources of risk:
  - **USER**: The agent can identify individuals or roles with high-volume sensitive data transfers.
  - **EVENT_DOMAIN**: The agent can highlight external domains frequently receiving sensitive company data.
  - **CONTENT_CATEGORY**: The agent can determine which types of sensitive information are most often transferred.
- **DLP Suggestion**: This enables the agent to make targeted DLP recommendations:
  - For high-risk users: The agent can suggest more restrictive DLP policies or audit logging.
  - For risky domains: The agent can recommend DLP rules to block or warn on transfers to these specific domains.
  - For common content categories: The agent can suggest enabling and configuring relevant DLP detectors.

## 3. queryUrlVisits

- **Action**: `queryUrlVisits`
- **Subscription**: Requires Chrome Enterprise Premium.
- **Insight for Security Posture**: Provides the agent with an organization-wide summary of visits to websites classified by risk level (High, Medium, Low).
- **Use Case**: The agent can assess the overall threat landscape from web browsing. A high volume of risky site visits indicates increased vulnerability to web-based threats.
- **DLP Related Suggestion**: The agent can use this data to emphasize the need for a paid Chrome Enterprise Premium subscription to gain visibility into browsing-related risks. This visibility is crucial as risky browsing can be a precursor to data loss incidents, making a comprehensive security posture including DLP even more important.

## 4. queryUrlVisitsBreakdowns

- **Action**: `queryUrlVisitsBreakdowns`
- **Subscription**: Requires Chrome Enterprise Premium.
- **Insight for Security Posture**: Provides the agent with a more detailed breakdown of URL visit data by User or Event Domain.
- **Use Case**: The agent can identify specific users who frequently visit high-risk sites or common high-risk domains being accessed within the organization.
- **DLP Related Suggestion**: Targeted security recommendations can be made by the agent. The agent can also reinforce that these granular insights and the ability to act on them are features of the Chrome Enterprise Premium subscription.
