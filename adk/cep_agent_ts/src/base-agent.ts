/**
 * @fileoverview Base Agent logic for interacting with Vertex AI models.
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

import {
  GenerativeModel,
  VertexAI,
  GenerateContentRequest,
  Part,
  Content,
  FunctionDeclaration,
  Tool,
} from '@google-cloud/vertexai'
import { McpClientWrapper } from './util/mcp-client.js'
import { convertMcpToolsToVertexAi } from './util/vertex-ai-adapter.js'

/**
 * Interface defining a local tool that can be executed by the agent.
 */
export interface LocalTool {
  name: string
  description: string
  parameters: any // JSON Schema
  execute(args: any): Promise<string>
}

/**
 * Manages the interaction loop with Vertex AI, handling tool execution and response generation.
 */
export class BaseAgent {
  protected model: GenerativeModel
  protected mcpClient: McpClientWrapper
  protected localTools: Map<string, LocalTool> = new Map()
  private toolsCache: Tool[] | null = null
  private MAX_ITERATIONS = 10

  /**
   * Initializes the Base Agent.
   */
  constructor(
    projectId: string,
    location: string,
    modelName: string,
    systemInstruction: string,
    mcpClient: McpClientWrapper,
    localTools: LocalTool[] = [],
  ) {
    const vertexAI = new VertexAI({ project: projectId, location: location })

    this.model = vertexAI.getGenerativeModel({
      model: modelName,
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemInstruction }],
      },
    })

    this.mcpClient = mcpClient
    localTools.forEach(tool => this.localTools.set(tool.name, tool))
  }

  /**
   * Retrieves the available tools for the agent, caching the result.
   */
  async getTools(): Promise<Tool[]> {
    if (this.toolsCache) {
      return this.toolsCache
    }

    const mcpToolsResult = await this.mcpClient.listTools()
    const mcpFunctionDeclarations = convertMcpToolsToVertexAi(mcpToolsResult)

    const localFunctionDeclarations: FunctionDeclaration[] = Array.from(this.localTools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }))

    this.toolsCache = [
      {
        functionDeclarations: [...mcpFunctionDeclarations, ...localFunctionDeclarations],
      },
    ]

    return this.toolsCache
  }

  /**
   * Runs the agent with the given prompt, handling tool execution loops.
   */
  async run(prompt: string): Promise<string> {
    const tools = await this.getTools()

    const chat = this.model.startChat({
      tools: tools,
    })

    const result = await chat.sendMessage(prompt)
    const response = await result.response

    // Safety check for candidates
    if (!response.candidates || response.candidates.length === 0) {
      console.error('[agent] No response candidates from model.')
      return 'No response from model.'
    }

    let currentResponse = response
    let iteration = 0

    while (iteration < this.MAX_ITERATIONS) {
      const parts = currentResponse.candidates?.[0]?.content?.parts || []
      const functionCalls = parts.filter(part => part.functionCall)

      if (functionCalls.length > 0) {
        const toolResponses: Part[] = []

        for (const call of functionCalls) {
          if (!call.functionCall) {
            continue
          }

          const name = call.functionCall.name
          const args = call.functionCall.args

          console.log(`[tool:exec] ${name}`, JSON.stringify(args))

          try {
            let content: any
            if (this.localTools.has(name)) {
              // Execute local tool (sub-agent)
              const result = await this.localTools.get(name)!.execute(args)
              content = { result }
            } else {
              // Execute MCP tool
              const toolResult = await this.mcpClient.callTool(name, args)
              content = toolResult.content
            }

            toolResponses.push({
              functionResponse: {
                name: name,
                response: {
                  content: content,
                },
              },
            })
            console.log(`[tool:ok] ${name}`)
          } catch (error) {
            console.error(`[tool:error] ${name}:`, error)
            toolResponses.push({
              functionResponse: {
                name: name,
                response: {
                  error: String(error),
                },
              },
            })
          }
        }

        // Send tool outputs back to model
        const result = await chat.sendMessage(toolResponses)
        currentResponse = await result.response
        iteration++
      } else {
        // No function calls, just text
        return parts.map(p => p.text).join(' ')
      }
    }

    console.warn('[agent] Max iterations reached.')
    return 'Max iterations reached without final response.'
  }
}
