import { describe, it } from 'node:test'
import assert from 'node:assert'
import { formatToolResponse, safeFormatResponse } from '../../tools/utils/wrapper.js'

describe('formatToolResponse', () => {
  it('returns two content blocks: summary and fenced JSON', () => {
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
  it('returns formatted response when formatFn succeeds', () => {
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

  it('returns raw data when formatFn throws', () => {
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
