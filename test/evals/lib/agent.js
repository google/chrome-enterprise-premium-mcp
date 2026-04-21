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

/**
 * @file Lightweight Gemini function-calling agent loop for evals.
 *
 * Replaces the Python LangChain agent (langchain_agent.py). Loads the
 * server's actual system prompt, converts MCP tool schemas to Gemini
 * function declarations, and runs a standard tool-use conversation loop.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildServerInstructions } from '../../../lib/knowledge/instructions.js'

const MODEL_NAME = 'gemini-2.5-flash'
const MAX_TURNS = 15

/**
 * Recursively strips fields that Gemini doesn't support from a JSON Schema.
 * @param {object} obj - The schema object.
 * @param {object} opts - Configuration options.
 * @param {boolean} opts.useUppercaseTypes - Whether to uppercase 'type' values (required by internal proxy).
 */
function stripUnsupportedFields(obj, { useUppercaseTypes } = {}) {
  if (!obj || typeof obj !== 'object') {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(o => stripUnsupportedFields(o, { useUppercaseTypes }))
  }

  const cleaned = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'additionalProperties' || key === '$schema') {
      continue
    }
    if (key === 'type' && typeof value === 'string' && useUppercaseTypes) {
      cleaned[key] = value.toUpperCase()
      continue
    }
    cleaned[key] = stripUnsupportedFields(value, { useUppercaseTypes })
  }
  return cleaned
}

/**
 * Converts an MCP tool schema to a Gemini function declaration.
 * @param {object} mcpTool - MCP tool definition.
 * @param {object} opts - Configuration options.
 */
function mcpToolToGemini(mcpTool, opts) {
  const schema = mcpTool.inputSchema || {}
  const parameters = stripUnsupportedFields(
    {
      type: opts.useUppercaseTypes ? 'OBJECT' : 'object',
      properties: schema.properties || {},
      ...(schema.required?.length ? { required: schema.required } : {}),
    },
    opts,
  )
  return {
    name: mcpTool.name,
    description: mcpTool.description || '',
    parameters,
  }
}

/**
 * Creates an eval agent that uses Gemini function calling with MCP tools.
 * @param {object} opts
 * @param {string} opts.apiKey - Gemini API key.
 * @param {string} [opts.baseUrl] - Optional base URL for the Gemini API (e.g. for proxy).
 * @param {import('@modelcontextprotocol/sdk/client/index.js').Client} opts.mcpClient - MCP client.
 * @returns {Promise<{ query: (prompt: string) => Promise<AgentResult> }>}
 */
export async function createEvalAgent({ apiKey, baseUrl, mcpClient }) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for the eval agent.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const agentOpts = { useUppercaseTypes: !!baseUrl }

  let systemPrompt = ''
  if (process.env.NO_EXPERT_PROMPT === 'true') {
    systemPrompt = 'You are a helpful AI assistant. Use the tools provided to answer the user.'
  } else {
    // Use the same assembly the server ships via InitializeResult.instructions,
    // so the eval agent sees the exact grounding payload a production MCP
    // client receives (system prompt + capabilities contract + Knowledge Index).
    systemPrompt = buildServerInstructions()
  }

  // Fetch tool definitions from MCP server
  const { tools: mcpTools } = await mcpClient.listTools()
  const functionDeclarations = mcpTools.map(t => mcpToolToGemini(t, agentOpts))

  const model = genAI.getGenerativeModel(
    {
      model: MODEL_NAME,
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations }],
    },
    { baseUrl },
  )

  /**
   * Sends a prompt to the agent and runs the tool-call loop until completion.
   * @param {string} prompt - User prompt.
   * @returns {Promise<AgentResult>}
   */
  async function query(prompt) {
    const toolCalls = []
    const chat = model.startChat()

    let response = await chat.sendMessage(prompt)
    let candidate = response.response.candidates?.[0]

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const parts = candidate?.content?.parts || []
      const fnCalls = parts.filter(p => p.functionCall)

      if (fnCalls.length === 0) {
        break
      } // Model gave a text response, we're done

      // Execute each function call via MCP
      const fnResponses = []
      for (const part of fnCalls) {
        const { name, args } = part.functionCall
        toolCalls.push({ name, args })

        try {
          const result = await mcpClient.callTool({ name, arguments: args || {} })

          // MCP tools often return multiple content blocks (e.g., 0: Summary, 1: Raw JSON).
          // Concatenate all text parts to ensure the agent has full context for both
          // human-readable reasoning and technical data extraction.
          const text =
            (result.content || [])
              .map(c => c.text)
              .filter(Boolean)
              .join('\n\n') || JSON.stringify(result)

          fnResponses.push({
            functionResponse: { name, response: { content: text } },
          })
        } catch (err) {
          fnResponses.push({
            functionResponse: { name, response: { content: `Error: ${err.message}` } },
          })
        }
      }

      // Send tool results back to model
      response = await chat.sendMessage(fnResponses)
      candidate = response.response.candidates?.[0]
    }

    // Extract final text response
    const parts = candidate?.content?.parts || []
    const textParts = parts.filter(p => p.text).map(p => p.text)
    const responseText = textParts.join('\n') || 'Error: Agent returned no text output.'

    return { responseText, toolCalls }
  }

  return { query }
}

/**
 * @typedef {object} AgentResult
 * @property {string} responseText - Final text response from the agent.
 * @property {{ name: string, args: object }[]} toolCalls - Tools called during execution.
 */
