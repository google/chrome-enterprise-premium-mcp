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

export function assertObjectMatches(actual, expected) {
  const subset = Object.fromEntries(Object.keys(expected).map(k => [k, actual[k]]))
  assert.deepStrictEqual(subset, expected)
}

export function parseToolOutput(result) {
  assert.ok(result?.content, 'Tool result missing content')
  const text = result.content[0].text

  // Use structured data provided by the MCP server.
  const details = result.structuredContent || null

  return { text, details }
}
