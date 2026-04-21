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

import { describe, test, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { registerKnowledgeTools } from '../../tools/definitions/knowledge.js'

const MOCK_DOC_PASSWORD_POLICY = 'password-policy'
const MOCK_DOC_PASSWORD_COMPLEXITY = 'Password complexity'
const MOCK_DOC_DOES_NOT_EXIST = 'does-not-exist'
const EXPECTED_DOC_COUNT = 4

describe('Knowledge Tools Native Search Integration', () => {
  let allDocs
  let docLookup
  let idToDoc
  let server
  let handlers = {}

  beforeEach(() => {
    docLookup = new Map()
    idToDoc = new Map()

    allDocs = [
      {
        id: 1,
        filename: MOCK_DOC_PASSWORD_POLICY,
        kind: 'policies',
        title: MOCK_DOC_PASSWORD_COMPLEXITY,
        url: 'https://example/pass',
        content: 'This policy enforces password complexity requirements.',
        deprecated: 0,
      },
      {
        id: 2,
        filename: 'old-policy',
        kind: 'policies',
        title: 'Old Policy',
        url: 'https://example/old',
        content: 'This is an old policy.',
        deprecated: 1,
      },
      {
        id: 3,
        filename: 'help-article',
        kind: 'helpcenter',
        title: 'How to reset password',
        url: 'https://example/reset',
        content: 'Steps to reset your password.',
        deprecated: 0,
      },
      {
        id: EXPECTED_DOC_COUNT,
        filename: 'curated-guide',
        kind: 'curated',
        title: 'Curated Guide',
        url: 'https://example/guide',
        content: 'A curated guide for admins.',
        deprecated: 0,
      },
    ]

    for (const doc of allDocs) {
      docLookup.set(doc.filename, doc)
      idToDoc.set(String(doc.id), doc)
    }

    // Mock server
    server = {
      registerTool: mock.fn((name, desc, handler) => {
        handlers[name] = handler
      }),
    }

    // Register tools with mock data
    registerKnowledgeTools(server, { allDocs, docLookup, idToDoc }, {})
  })

  test('When searched with a keyword, then search_content finds matching text', async () => {
    const handler = handlers['search_content']
    assert.ok(handler)

    // Search for 'enforces' -> should match 'enforces'
    let result = await handler({ query: 'enforces' }, { requestInfo: {} })
    let rows = result.structuredContent.documents
    assert.strictEqual(rows.length, 1)
    assert.strictEqual(rows[0].title, MOCK_DOC_PASSWORD_COMPLEXITY)

    // Search for 'password' -> should match MOCK_DOC_PASSWORD_COMPLEXITY and 'How to reset password'
    result = await handler({ query: 'password' }, { requestInfo: {} })
    rows = result.structuredContent.documents
    assert.strictEqual(rows.length, 2)
  })

  test('When document is requested by filename, then get_document returns full content', async () => {
    const handler = handlers['get_document']
    assert.ok(handler)

    const result = await handler({ filename: MOCK_DOC_PASSWORD_POLICY }, { requestInfo: {} })
    const data = result.structuredContent.documents[0]
    assert.strictEqual(data.title, MOCK_DOC_PASSWORD_COMPLEXITY)
    assert.strictEqual(data.content, 'This policy enforces password complexity requirements.')
  })

  test('When given an array of mixed identifiers, then get_document returns multiple documents', async () => {
    const handler = handlers['get_document']
    assert.ok(handler)

    // Exercise BOTH lookup branches: MOCK_DOC_PASSWORD_POLICY hits docLookup directly;
    // '3' falls through to idToDoc.
    const result = await handler({ filename: [MOCK_DOC_PASSWORD_POLICY, '3'] }, { requestInfo: {} })
    assert.strictEqual(result.structuredContent.documents.length, 2)
    assert.deepStrictEqual(result.structuredContent.missing, [])
    const summaryText = result.content[0].text
    assert.ok(/Password complexity/i.test(summaryText))
    assert.ok(/How to reset password/i.test(summaryText))
    // Multiple docs are concatenated with the `---` separator.
    assert.ok(/\n---\n/.test(summaryText), 'expected --- separator between concatenated docs')
  })

  test('When some requested documents are missing, then get_document handles partial misses inline', async () => {
    const handler = handlers['get_document']
    assert.ok(handler)

    const result = await handler({ filename: ['1', MOCK_DOC_DOES_NOT_EXIST] }, { requestInfo: {} })
    assert.strictEqual(result.structuredContent.documents.length, 1)
    assert.strictEqual(result.structuredContent.documents[0].title, MOCK_DOC_PASSWORD_COMPLEXITY)
    assert.deepStrictEqual(result.structuredContent.missing, [MOCK_DOC_DOES_NOT_EXIST])
    const summaryText = result.content[0].text
    assert.ok(/Missing:.*does-not-exist/i.test(summaryText))
    assert.ok(!result.isError, 'partial-miss must not be an error; the found docs are useful')
  })

  test('When no requested documents are found, then get_document returns an error', async () => {
    const handler = handlers['get_document']
    assert.ok(handler)

    const result = await handler({ filename: [MOCK_DOC_DOES_NOT_EXIST, 'also-missing'] }, { requestInfo: {} })
    assert.strictEqual(result.isError, true)
    assert.strictEqual(result.structuredContent.documents.length, 0)
    assert.deepStrictEqual(result.structuredContent.missing, [MOCK_DOC_DOES_NOT_EXIST, 'also-missing'])
  })

  test('When numeric articleIds are provided, then input schema coerces them to strings', () => {
    // Gemini sometimes extracts an articleId from a Markdown cross-link as a
    // number (e.g. 5) rather than a string ("5"). The input schema must coerce
    // so the tool does not reject the call at the validation boundary.
    const registerTool = server.registerTool
    // Zod schema is captured when the tool was registered; grab it from the
    // mock's call args. `mock.fn` stores calls in `.mock.calls[].arguments`.
    const getDocCall = registerTool.mock.calls.find(c => c.arguments[0] === 'get_document')
    assert.ok(getDocCall, 'get_document must be registered')
    const schema = getDocCall.arguments[1].inputSchema
    const asNumber = schema.parse({ filename: 5 })
    assert.strictEqual(asNumber.filename, '5')
    const asArray = schema.parse({ filename: [4, '6-dlp-troubleshooting'] })
    assert.deepStrictEqual(asArray.filename, ['4', '6-dlp-troubleshooting'])
  })

  test('When list_documents is called, then it returns all documents', async () => {
    const handler = handlers['list_documents']
    assert.ok(handler)

    const result = await handler({}, { requestInfo: {} })
    const rows = result.structuredContent.documents
    assert.strictEqual(rows.length, EXPECTED_DOC_COUNT)
  })

  test('When searched with multi-word query, then search_content finds matching text', async () => {
    const handler = handlers['search_content']
    assert.ok(handler)

    const result = await handler({ query: 'complexity requirements' }, { requestInfo: {} })
    const rows = result.structuredContent.documents
    assert.ok(rows.length >= 1)
    assert.strictEqual(rows[0].title, MOCK_DOC_PASSWORD_COMPLEXITY)
  })
})
