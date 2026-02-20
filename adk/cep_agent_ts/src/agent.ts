/**
 * @fileoverview Agent definition and exports.
 */

/*
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
*/

import { BaseAgent, LocalTool } from './base-agent.js'
import { McpClientWrapper } from './util/mcp-client.js'
import { SubAgentTool } from './sub-agent-tool.js'
import { AGENT_NAMES, MODEL_NAMES, PROMPTS, LOCATIONS } from './constants.js'
import 'dotenv/config'

// --- Initialization ---

const projectId = process.env.GOOGLE_CLOUD_PROJECT
if (!projectId) {
  console.warn('[warn] GOOGLE_CLOUD_PROJECT not set. Agent commands may fail.')
}

// Global MCP Client instance (Lazy connection)
export const mcpClient = new McpClientWrapper()

// --- Agent Factory Logic ---

/**
 * Creates the Metadata Agent.
 */
function createMetadataAgent(): BaseAgent {
  return new BaseAgent(
    projectId || 'unknown-project',
    LOCATIONS.US_CENTRAL1,
    MODEL_NAMES.GEMINI_2_0_FLASH,
    PROMPTS.METADATA,
    mcpClient,
  )
}

/**
 * Creates the Troubleshooting Agent.
 */
function createTroubleshootingAgent(): BaseAgent {
  return new BaseAgent(
    projectId || 'unknown-project',
    LOCATIONS.US_CENTRAL1,
    MODEL_NAMES.GEMINI_2_0_FLASH,
    PROMPTS.TROUBLESHOOTING,
    mcpClient,
  )
}

/**
 * Creates the Onboarding Agent.
 */
function createOnboardingAgent(): BaseAgent {
  return new BaseAgent(
    projectId || 'unknown-project',
    LOCATIONS.US_CENTRAL1,
    MODEL_NAMES.GEMINI_2_0_FLASH,
    PROMPTS.ONBOARDING,
    mcpClient,
  )
}

/**
 * Creates the Orchestrator Agent.
 */
function createOrchestratorAgent(): BaseAgent {
  const metadataAgent = createMetadataAgent()
  const troubleshootingAgent = createTroubleshootingAgent()
  const onboardingAgent = createOnboardingAgent()

  const tools: LocalTool[] = [
    new SubAgentTool(
      AGENT_NAMES.METADATA,
      'Strict Data Retrieval Tool. Returns Customer ID and Root Org Unit ID.',
      metadataAgent,
    ),
    new SubAgentTool(
      AGENT_NAMES.TROUBLESHOOTING,
      'Troubleshoots DLP rules. Requires Orchestrator to provide Customer/Org IDs.',
      troubleshootingAgent,
    ),
    new SubAgentTool(AGENT_NAMES.ONBOARDING, 'Handles setup and best practices.', onboardingAgent),
  ]

  return new BaseAgent(
    projectId || 'unknown-project',
    LOCATIONS.US_CENTRAL1,
    MODEL_NAMES.GEMINI_2_0_FLASH,
    PROMPTS.ORCHESTRATOR,
    mcpClient,
    tools,
  )
}

// --- Exports ---

/**
 * The main CEP Orchestrator Agent.
 */
export const cepAgent = createOrchestratorAgent()
