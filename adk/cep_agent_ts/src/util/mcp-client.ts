/**
 * @fileoverview MCP Client Wrapper for connecting to the MCP Server.
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

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { MCP_SERVER_PATH, PROJECT_ROOT } from '../constants.js'

/**
 * Wraps the MCP Client and Transport to manage the connection to the MCP Server.
 */
export class McpClientWrapper {
  private client: Client
  private transport: StdioClientTransport
  private isConnected: boolean = false

  /**
   * Initializes the MCP Client Wrapper.
   */
  constructor() {
    this.transport = new StdioClientTransport({
      command: 'node',
      args: [MCP_SERVER_PATH],
      env: { ...process.env, GCP_STDIO: 'true' },
      cwd: PROJECT_ROOT,
    })

    this.client = new Client(
      {
        name: 'cep-agent-ts-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    )
  }

  /**
   * Connects to the MCP Server if not already connected.
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    await this.client.connect(this.transport)
    this.isConnected = true
    console.log(`[mcp] Connected to server at ${MCP_SERVER_PATH}`)
  }

  /**
   * Lists the available tools from the MCP Server.
   * @returns The list of tools.
   */
  async listTools() {
    await this.connect()
    return await this.client.listTools()
  }

  /**
   * Calls a tool on the MCP Server.
   * @param name The name of the tool to call.
   * @param args The arguments to pass to the tool.
   * @returns The result of the tool call.
   */
  async callTool(name: string, args: any) {
    await this.connect()
    return await this.client.callTool({
      name,
      arguments: args,
    })
  }

  /**
   * Closes the connection to the MCP Server.
   */
  async close(): Promise<void> {
    if (!this.isConnected) {
      return
    }
    await this.client.close()
    this.isConnected = false
  }
}
