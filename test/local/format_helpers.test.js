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
*/ import { describe, test } from 'node:test'
import assert from 'node:assert'
import { formatToolResponse, safeFormatResponse } from '../../tools/utils/wrapper.js'

describe('formatToolResponse', () => {
  test('When data is provided, then it returns two content blocks: summary and fenced JSON', () => {
    const result = formatToolResponse({
      summary: 'Test summary.',
      data: { key: 'value' },
      structuredContent: { key: 'value' },
    })
    assert.strictEqual(result.content.length, 2)
    assert.strictEqual(result.content[0].text, 'Test summary.')
    assert.ok(result.content[1].text.startsWith('```json\n'))
    assert.ok(result.content[1].text.endsWith('\n```'))
    assert.deepStrictEqual(result.structuredContent, { key: 'value' })
  })
})

describe('safeFormatResponse', () => {
  test('When formatFn succeeds, then it returns the formatted response', () => {
    const result = safeFormatResponse({
      rawData: { items: [1, 2] },
      formatFn: data =>
        formatToolResponse({
          summary: `Found ${data.items.length} items.`,
          data,
          structuredContent: data,
        }),
      toolName: 'test_tool',
    })
    assert.strictEqual(result.content[0].text, 'Found 2 items.')
  })

  test('When formatFn throws, then it falls back to returning raw data', () => {
    const result = safeFormatResponse({
      rawData: { fallback: true },
      formatFn: () => {
        throw new Error('format failed')
      },
      toolName: 'test_tool',
    })
    assert.ok(result.content[0].text.includes('test_tool completed'))
    assert.ok(result.content[1].text.includes('fallback'))
    assert.deepStrictEqual(result.structuredContent, { fallback: true })
  })
})
