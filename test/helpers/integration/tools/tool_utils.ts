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

import assert from 'node:assert/strict'

/**
 * Asserts that the actual object matches all expected key-value properties.
 * @param actual The actual object to assert.
 * @param expected The expected property subset dictionary.
 */
export function assertObjectMatches(actual: Record<string, unknown>, expected: Record<string, unknown>): void {
  const subset = Object.fromEntries(Object.keys(expected).map(k => [k, actual[k]]))
  assert.deepStrictEqual(subset, expected)
}

import { isObject, getString, getObject } from '../../../../lib/util/helpers.js'

export interface ToolOutput {
  text: string
  details: Record<string, unknown> | null
}

/**
 * Parses the MCP tool execution result into standard text and structured outputs.
 * @param result The raw MCP tool call result payload.
 * @returns Parsed tool output details.
 */
export function parseToolOutput(result: unknown): ToolOutput {
  if (isObject(result)) {
    const toolResult = getObject(result, 'toolResult')
    const target = toolResult || result

    if (isObject(target)) {
      const content = target['content']
      if (Array.isArray(content) && content.length > 0) {
        const firstContent: unknown = content[0]
        if (isObject(firstContent)) {
          const text = getString(firstContent, 'text') || ''
          const details = getObject(target, 'structuredContent') || null
          return { text, details }
        }
      }
    }
  }
  throw new Error('Tool result content is empty, invalid, or not an array')
}
