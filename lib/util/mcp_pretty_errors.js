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

import { z } from 'zod'
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js'

/**
 * Replaces the MCP SDK's default input-validation error message — which is
 * the JSON-stringified ZodError issues array in zod v4 — with the readable
 * multi-line summary z.prettifyError() produces. Wraps validateToolInput on
 * the supplied McpServer instance; falls back to the original error if the
 * tool doesn't expose a parseable inputSchema.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server - The McpServer instance to wrap.
 * @returns {void}
 */
export function installPrettyValidationErrors(server) {
  const orig = server.validateToolInput.bind(server)
  server.validateToolInput = async function (tool, args, name) {
    try {
      return await orig(tool, args, name)
    } catch (err) {
      if (err instanceof McpError && err.code === ErrorCode.InvalidParams) {
        const result = tool.inputSchema?.safeParse?.(args)
        if (result && !result.success) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid arguments for tool ${name}:\n${z.prettifyError(result.error)}`,
          )
        }
      }
      throw err
    }
  }
}
