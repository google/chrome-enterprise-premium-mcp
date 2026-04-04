# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
This file contains the code for the CEP agent. It can be configured as a single
agent or a multi-agent system. The agent handles queries and relays the requests
to the CEP MCP server for further processing.
"""

from __future__ import annotations
import os
import google.auth
from google.auth.exceptions import DefaultCredentialsError
from google.adk.agents import LlmAgent
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from google.adk.tools.mcp_tool.mcp_toolset import StdioServerParameters
from .auth_utils import get_auth_instructions

# Get the directory of the current Python file
current_file_dir = os.path.dirname(os.path.abspath(__file__))

# Construct the path to mcp-server.js relative to this file
mcp_server_path = os.path.join(current_file_dir, '../../mcp-server.js')

AI_MODEL_NAME = 'gemini-2.5-flash'

def check_credentials():
    """Checks for Google Cloud Application Default Credentials."""
    try:
        google.auth.default()
    except DefaultCredentialsError as e:
        print(get_auth_instructions(e))
    except Exception as e:
        print(f"An unexpected error occurred during credential check: {e}")

# Verify credentials before proceeding
check_credentials()

cep_tools_local = McpToolset(
    connection_params=StdioServerParameters(
        command='node',
        args=[mcp_server_path],
    )
)

metadata_agent = LlmAgent(
    model=AI_MODEL_NAME,
    name='metadata_agent',
    description=(
        'Strict Data Retrieval Tool. Returns Customer ID and Root Org Unit ID.'
    ),
    instruction="""You are a silent data fetcher.
    1. Call your tools to find the Customer ID and the Root Org Unit ID.
    2. Output ONLY the IDs in this format: "Context: CustomerID=[ID], OrgUnitID=[ID]".
    3. Do NOT converse with the user. Do NOT ask clarifying questions. Just return the data.""",
    tools=[cep_tools_local],
)

troubleshooting_agent = LlmAgent(
    model=AI_MODEL_NAME,
    name='troubleshooting_agent',
    description=(
        'Troubleshoots DLP rules. Requires Orchestrator to provide Customer/Org IDs.'
    ),
    instruction="""You are a technical debugger for Chrome Enterprise Premium.

    ### CRITICAL CONSTRAINTS:
    1. **NEVER ask for IDs**: Assume the Orchestrator has provided 'CustomerID' and 'OrgUnitID' in the prompt. Use them.
    2. **NEVER hallucinate rule names**: Only discuss rules that actually appear in the tool output.

    ### EXECUTION SCRIPT:
    Step 1: **FETCH RULES**: Call `list_dlp_rules` using the OrgUnitID provided in the context.
    Step 2: **FILTER**: Look at the list. Filter for rules matching the user's issue (e.g., if user says "download", keep only download rules).
    Step 3: **CONNECTOR CHECK**: For the filtered rules, immediately check the `connector_settings` to see if the connector is active.
    Step 4: **REPORT**: Present the findings to the user:
       - "I found X rules related to downloads."
       - "Rule 'A' is active but the connector seems [Status]."
       - Ask: "Would you like to debug Rule A or Rule B deeply?"
    """,
    tools=[cep_tools_local],
)

onboarding_agent = LlmAgent(
    model=AI_MODEL_NAME,
    name='onboarding_agent',
    description='Handles setup and best practices.',
    instruction="""You are an onboarding specialist.
    - If the user asks "What next?", check if they have any DLP rules created.
    - If no rules exist, suggest creating a "Block Sensitive Content" rule.
    - ALWAYS use the 'OrgUnitID' provided by the Orchestrator for all tool calls.
    - Do not ask the user for configuration details unless absolutely necessary. Propose defaults (e.g., "Shall I apply this to the Root Org Unit?").""",
    tools=[cep_tools_local],
)

# Multi-agent approach
multi_agent = LlmAgent(
    model=AI_MODEL_NAME,
    name='orchestrator_agent',
    instruction="""You are the Orchestrator. You control the flow to prevent hallucination.

    ### PHASE 1: CONTEXT ACQUISITION
    Before answering ANY user question, you must verify if you have the `customer_id` and `org_unit_id`.
    - **IF MISSING**: Immediately call `metadata_agent`. Do not say anything to the user yet.
    - **IF PRESENT**: Proceed to Phase 2.

    ### PHASE 2: DELEGATION WITH INJECTION
    You must pass the IDs to the sub-agents so they don't ask the user.

    **Example of CORRECT Delegation:**
    User: "My download rules are broken."
    Action: Call `troubleshooting_agent` with input:
    "User reports: 'My download rules are broken'.
     SYSTEM CONTEXT: Use CustomerID='C02...' and OrgUnitID='id:03...' for all tool calls."

    **Example of INCORRECT Delegation (Do NOT do this):**
    Action: Call `troubleshooting_agent` with input: "My download rules are broken."
    (This causes hallucination because the agent lacks the IDs).

    ### PHASE 3: RESPONSE
    - Return the sub-agent's response to the user.
    - If a tool fails, be honest: "I attempted to check the settings but the tool returned an error." Do not make up a success message.
    """,
    tools=[
        AgentTool(agent=metadata_agent),
        AgentTool(agent=troubleshooting_agent),
        AgentTool(agent=onboarding_agent),
    ],
)

# Single Agent approach
single_agent = LlmAgent(
    model=AI_MODEL_NAME,
    name='chrome_enterprise_agent',
    instruction="""You are an expert on Chrome Enterprise Premium.
You are responsible for:
- Assisting customers with onboarding: suggesting next steps, creating DLP rules (including Data Masking rules), setting connector policies and modifying browser settings.
- Supporting Data Masking flows: You can create rules that redact sensitive information like Social Security Numbers on specific websites (e.g., Generative AI sites).
- Troubleshooting issues such as DLP rules not working or insights not generating. For troubleshooting, first list the DLP rules and ask user if
- they want to debug any of them. Or else based on the condition recommend looking at troubleshooting one of the DLP rules. The org unit id should be clearly specified in the list DLP rule response.
- Additionally, once you verify the connector settings are corrrect, next step
  is to provide user with list of DLP rules that they want to debug.
  Provide contextual list , for example if user is targeting uploads then give
  a list of upload rules.Once you verify the basic rule structure, next step is
  to clarify if it is happening for a particular user or all the users. If for a
  user then check if the user is in the right org unit and next step is to check
  if the user has a chrome enterprise premium license.
- Providing metadata like customer ID or org unit ID if needed to perform actions or answer questions.
- Assisting users with inquiries about Data protection rules, browser settings, enabling insights, and Chrome log events.

To recommend DLP rules, first list the existing DLP rules to see what is already configured. Then, list chrome activity, find out what are the top risky/unrisky events and then recommend new DLP rules based on that, avoiding duplication with existing rules.

When assisting with onboarding:
Based on the user's request, guide the user with the next steps by suggesting defaults. The user might not know inputs like Org Unit ID, so guide them by fetching available Org Units using your tools.
For Org Unit ID, always suggest root org unit ID but also provide a list of possible values if you can retrieve them.
Never ask for the customer ID, use your tools to retrieve it.

When troubleshooting or onboarding requires metadata like customer ID or org unit ID, use your tools to retrieve it.
""",
    tools=[cep_tools_local],
)

# TODO: Dynamically set this to either single_agent or multi_agent.
root_agent = single_agent

