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

The agent uses the `gemini-3.1-flash-lite-preview` model (defined as `AI_MODEL_NAME` in `agent.py`) and reaches the CEP MCP server through an MCP toolset.

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

### 1. Setup Python Virtual Environment & Install Dependencies

To prevent conflicts with system-level packages, create a local Python virtual environment, activate it, and install the required dependencies (which handles the `google-adk` framework and the necessary `mcp` Python SDK):

```bash
# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r adk/cep_agent/requirements.txt
```

### 2. Authenticate the MCP Server

The MCP server must be authorized to call Google Workspace admin APIs on your behalf.

Run the standard cached OAuth login flow from the repository root:

```bash
npm run auth:login
```

_(If you installed the server from the npm registry instead of cloning the repository, run `npx -y @google/chrome-enterprise-premium-mcp@latest auth login` instead)._

For enterprise environments that require using a custom OAuth client or service account, see the configuration steps in [`docs/auth-bring-your-own-oauth-client.md`](../../docs/auth-bring-your-own-oauth-client.md).

### 3. Configure Gemini LLM Authentication

The ADK Agent requires access to the Gemini API to serve as its conversational engine. You can authenticate using either Vertex AI (leveraging standard Google Cloud credentials) or a direct Google AI Studio API Key:

**Option A: Vertex AI (Recommended for corporate workstations)**
Ensure your workstation is authenticated to GCP and export these environment variables:

```bash
gcloud auth application-default login
export GOOGLE_GENAI_USE_VERTEXAI=1
export GOOGLE_CLOUD_PROJECT="YOUR_GCP_PROJECT_ID"
```

**Option B: Google AI Studio API Key**
Generate a key from AI Studio and export it:

```bash
export GEMINI_API_KEY="YOUR_AI_STUDIO_API_KEY"
```

### 4. Start the ADK Server

While your virtual environment is active, launch the ADK web interface:

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
