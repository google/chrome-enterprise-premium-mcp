/**
 * @fileoverview Utility to adapt MCP tool definitions for Vertex AI function declarations.
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

import { FunctionDeclaration, FunctionDeclarationSchemaType } from "@google-cloud/vertexai";
import { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Converts MCP tools to Vertex AI function declarations.
 */
export function convertMcpToolsToVertexAi(mcpTools: ListToolsResult): FunctionDeclaration[] {
  return mcpTools.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: convertSchema(tool.inputSchema),
  }));
}

/**
 * Converts a JSON schema to a Vertex AI compatible schema.
 */
function convertSchema(schema: any): any {
  // Simple pass-through for now as Vertex AI accepts JSON Schema
  // We might need to adjust types if strict checks fail
  return {
    type: FunctionDeclarationSchemaType.OBJECT,
    properties: schema.properties || {},
    required: schema.required || [],
  };
}
