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
 * @fileoverview MCP Prompt Registration Entry Point.
 *
 * Provides functions to register all available prompts with the MCP server.
 */

import { registerCepPrompt } from './definitions/cep.js'
import { registerDiagnosePrompt } from './definitions/diagnose.js'
import { registerMaturityPrompt } from './definitions/maturity.js'
import { registerNoisePrompt } from './definitions/noise.js'

/**
 * Registers all prompts with the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The MCP server instance
 */
export function registerPrompts(server) {
  registerCepPrompt(server)
  registerDiagnosePrompt(server)
  registerMaturityPrompt(server)
  registerNoisePrompt(server)
}
