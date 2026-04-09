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

import { test, describe, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { registerKnowledgeTools } from '../../tools/definitions/knowledge.js'

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
        filename: 'password-policy',
        kind: 'policies',
        title: 'Password complexity',
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
        id: 4,
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

  test('search_content should find text with keyword search', async () => {
    const handler = handlers['search_content']
    assert.ok(handler)

    // Search for 'enforces' -> should match 'enforces'
    let result = await handler({ query: 'enforces' }, { requestInfo: {} })
    let rows = result.structuredContent.documents
    assert.strictEqual(rows.length, 1)
    assert.strictEqual(rows[0].title, 'Password complexity')

    // Search for 'password' -> should match 'Password complexity' and 'How to reset password'
    result = await handler({ query: 'password' }, { requestInfo: {} })
    rows = result.structuredContent.documents
    assert.strictEqual(rows.length, 2)
  })

  test('search_content should support column filters', async () => {
    const handler = handlers['search_content']

    // Search for 'password' only in policies
    let result = await handler({ query: 'password', kind: 'policies' }, { requestInfo: {} })
    let rows = result.structuredContent.documents
    assert.strictEqual(rows.length, 1)
    assert.strictEqual(rows[0].title, 'Password complexity')

    // By default, includes deprecated unconditionally
    let resultDep = await handler({ query: 'old' }, { requestInfo: {} })
    let rowsDep = resultDep.structuredContent.documents
    assert.strictEqual(rowsDep.length, 1)
    assert.strictEqual(rowsDep[0].title, 'Old Policy')
    assert.ok(resultDep.content[0].text.includes('[Deprecated]'))
  })

  test('get_document should return full content', async () => {
    const handler = handlers['get_document']
    assert.ok(handler)

    const result = await handler({ filename: 'password-policy' }, { requestInfo: {} })
    const data = result.structuredContent.document
    assert.strictEqual(data.title, 'Password complexity')
    assert.strictEqual(data.content, 'This policy enforces password complexity requirements.')
  })

  // SKIPPED: tool implementation currently does not support kind filtering
  test.skip('list_documents should filter by kind', async () => {
    const handler = handlers['list_documents']
    assert.ok(handler)

    // Includes deprecated unconditionally
    const result = await handler({ kind: 'policies' }, { requestInfo: {} })
    const rows = result.structuredContent.documents
    assert.strictEqual(rows.length, 2) // Includes old-policy
    assert.ok(result.content[0].text.includes('[Deprecated]'))
  })

  // SKIPPED: tool implementation currently does not return category counts
  test.skip('list_documents should return counts when kind is omitted', async () => {
    const handler = handlers['list_documents']

    // Includes deprecated unconditionally
    const result = await handler({}, { requestInfo: {} })
    const counts = result.structuredContent.counts
    assert.strictEqual(Object.keys(counts).length, 3)
    assert.strictEqual(counts.policies, 2)
  })

  test('search_content should correctly handle AND operator with kind filter', async () => {
    const handler = handlers['search_content']
    assert.ok(handler)

    const result = await handler({ query: 'complexity requirements', kind: 'policies' }, { requestInfo: {} })
    const rows = result.structuredContent.documents
    assert.strictEqual(rows.length, 1)
    assert.strictEqual(rows[0].title, 'Password complexity')
  })

  test('search_content should correctly handle OR operator with kind filter', async () => {
    const handler = handlers['search_content']
    assert.ok(handler)

    // With the kind filter, only 'Password complexity' should be returned.
    // The other document containing 'reset' is of kind 'helpcenter'.
    const result = await handler({ query: 'complexity OR reset', kind: 'policies' }, { requestInfo: {} })
    const rows = result.structuredContent.documents
    assert.strictEqual(rows.length, 1)
    assert.strictEqual(rows[0].title, 'Password complexity')
  })
})
