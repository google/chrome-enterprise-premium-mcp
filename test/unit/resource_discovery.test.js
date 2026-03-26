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

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { extractValue, parseToolOutput } from '../helpers/integration/tools/tool_utils.js'

/**
 * Unit Tests for Resource Discovery Logic.
 */
describe('Resource Discovery logic', () => {
  test('should parse Customer ID with inconsistent whitespace and casing', () => {
    assert.strictEqual(extractValue('customer id:C0123456', 'Customer ID'), 'C0123456')
    assert.strictEqual(extractValue('CUSTOMER ID:   C0123456  \nnext line', 'Customer ID'), 'C0123456')
  })

  test('should parse JSON block with leading/trailing text', () => {
    const toolOutput = {
      content: [
        {
          text: `Markdown Header
Some text before.
{
  "name": "policies/123",
  "setting": { "value": { "displayName": "Test" } }
}
Some text after.`,
        },
      ],
    }
    const { details } = parseToolOutput(toolOutput)
    assert.strictEqual(details.name, 'policies/123')
  })

  test('should handle tool results that are just JSON arrays', () => {
    const toolOutput = {
      content: [
        {
          text: `Organizational Units:
[
  { "orgUnitId": "id:1" },
  { "orgUnitId": "id:2" }
]`,
        },
      ],
    }
    const { details } = parseToolOutput(toolOutput)
    assert.strictEqual(details.length, 2)
    assert.strictEqual(details[0].orgUnitId, 'id:1')
  })

  test('should gracefully handle text with no JSON', () => {
    const toolOutput = { content: [{ text: 'Just some plain text without braces' }] }
    const { details } = parseToolOutput(toolOutput)
    assert.strictEqual(details, null)
  })
})
