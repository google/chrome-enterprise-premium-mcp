<!--
Copyright 2026 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# CEP agent

A sample CEP agent that you can configure as a single agent or as a multi-agent system. The agent handles user queries and forwards the requests to the CEP MCP server for tool calls.

## Overview

The CEP agent assists with Chrome Enterprise Premium administration. You can configure it in two ways.

- **Single agent.** One agent handles every task, including onboarding, troubleshooting, and metadata retrieval.
- **Multi-agent.** A root agent delegates each task to a specialized agent for onboarding, troubleshooting, or metadata retrieval.

The agent uses the `gemini-2.5-flash` model (defined as `AI_MODEL_NAME` in `agent.py`) and reaches the CEP MCP server through an MCP toolset.

## Capabilities

- **Onboarding.** Walks an administrator through Chrome Enterprise Premium setup and configuration.
- **Troubleshooting.** Diagnoses DLP rule problems and other configuration issues.
- **Metadata retrieval.** Fetches the customer ID and organizational-unit IDs.

## Prerequisites

- Node.js installed and on `PATH`.
- The Google Cloud CLI (`gcloud`) installed and on `PATH`.
- The Agent Development Kit installed.

## Run the agent locally

Follow these steps to run the agent against a real Google Cloud project.

1. Authenticate to `gcloud` with the scope set the MCP server needs:

   ```bash
   gcloud auth application-default login \
     --scopes=openid,\
   https://www.googleapis.com/auth/userinfo.email,\
   https://www.googleapis.com/auth/chrome.management.policy,\
   https://www.googleapis.com/auth/chrome.management.reports.readonly,\
   https://www.googleapis.com/auth/chrome.management.profiles.readonly,\
   https://www.googleapis.com/auth/admin.reports.audit.readonly,\
   https://www.googleapis.com/auth/admin.directory.orgunit.readonly,\
   https://www.googleapis.com/auth/admin.directory.customer.readonly,\
   https://www.googleapis.com/auth/apps.licensing,\
   https://www.googleapis.com/auth/cloud-identity.policies,\
   https://www.googleapis.com/auth/service.management \
     --no-launch-browser
   ```

   For an OAuth-flow alternative that does not require `gcloud`, run `mcp auth login` from the repo root. For the setup walkthrough, see [`docs/auth-bring-your-own-oauth-client.md`](../../docs/auth-bring-your-own-oauth-client.md).

2. Start the ADK server:

   ```bash
   adk web --host 0.0.0.0 adk/
   ```

   The ADK server starts locally. Open the printed URL in a browser to interact with the agent.

## Usage

Send a query to the agent. The agent uses its tools and built-in knowledge to respond.

### Example interaction

> **You:** "My download rules are broken."
>
> **Agent:** "I found X rules related to downloads. Rule A is active, but the connector status looks `<status>`. Do you want to debug rule A or rule B in detail?"
