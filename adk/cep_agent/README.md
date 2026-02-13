# CEP Agent

This is a sample CEP agent that can be configured as a single agent or a
multi-agent system. The agent handles queries and relays the requests to the CEP
MCP server for further processing.

## Overview

The CEP agent is designed to assist with Chrome Enterprise Premium administration.
It can be configured in two ways:

- **Single Agent**: A single agent that can handle all tasks, including
  onboarding, troubleshooting, and metadata retrieval.
- **Multi-agent**: A multi-agent system with a root agent that delegates tasks
  to specialized agents for onboarding, troubleshooting, and metadata
  retrieval.

The agent uses the `gemini-2.0-flash` model and interacts with the CEP MCP server
via a toolset.

## Features

- **Onboarding**: Assists with setting up and configuring Chrome Enterprise
  Premium.
- **Troubleshooting**: Helps diagnose and resolve issues with DLP rules and
  other configurations.
- **Metadata Retrieval**: Fetches customer and organizational unit IDs.

## Getting Started

To get started with the CEP agent, you need to have the following prerequisites:

- Node.js installed
- gcloud CLI installed
- Agent development kit installed

### Running Locally

To run the agent locally, follow these steps:

1.  **Authenticate to gcloud:**

    ```bash
    gcloud auth application-default login \
        --scopes='https://www.googleapis.com/auth/chrome.management.reports.readonly,https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/chrome.management.profiles.readonly,https://www.googleapis.com/auth/cloud-identity.policies,https://www.googleapis.com/auth/admin.reports.audit.readonly,https://www.googleapis.com/auth/chrome.management.policy,https://www.googleapis.com/auth/admin.directory.orgunit.readonly,https://www.googleapis.com/auth/admin.directory.customer.readonly' \
        --no-launch-browser
    ```

2.  **Start the ADK server:**

    ```bash
    adk web --host 0.0.0.0 adk/
    ```

This will start the ADK server locally. You can then open your browser to interact with the agent.

## Usage

You can interact with the agent by sending it queries. The agent will then use
its tools and knowledge to provide a response.

### Example

**User**: "My download rules are broken."

**Agent**: "I found X rules related to downloads. Rule 'A' is active but the
connector seems [Status]. Would you like to debug Rule A or Rule B deeply?"
