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

import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import esmock from 'esmock'

describe('Knowledge Tools Real Database Integration', () => {
  const handlers = {}
  const fetched = []

  // Stub axios so get_document never reaches Helpcenter — that hop is slow,
  // racy, and dominates the unit-suite budget. The HTML we return is the
  // smallest payload that includes the substrings the assertions probe for.
  const stubHtml = `
    <html><body>
      <h1>Chrome Enterprise Premium</h1>
      <p>Deep scanning protection settings live under Chrome Enterprise Security Services.</p>
    </body></html>
  `

  before(async () => {
    const { registerKnowledgeTools } = await esmock('../../tools/definitions/knowledge.js', {
      axios: {
        default: {
          get: async url => {
            fetched.push(url)
            return { data: stubHtml }
          },
        },
      },
    })
    const server = {
      registerTool: (name, description, handler) => {
        handlers[name] = handler
      },
    }
    registerKnowledgeTools(server, { featureFlags: { isEnabled: () => true } }, {})
  })

  test('When searched for Licensing, then search_content finds the overview document', async () => {
    const handler = handlers['search_content']
    assert.ok(handler, 'search_content handler should be registered')

    const result = await handler({ query: 'Licensing' }, { requestInfo: {} })
    const documents = result.structuredContent.documents

    assert.ok(documents.length > 0, 'Should return at least one document')

    // Look for Chrome Enterprise Premium Overview and Implementation
    const policy = documents.find(d => d.title === 'Chrome Enterprise Premium Overview and Implementation')
    assert.ok(policy, 'Should find Chrome Enterprise Premium Overview and Implementation policy')
    assert.ok(policy.id, 'Found policy should have an ID')
  })

  test('When searched for DLP, then search_content finds the integration guide', async () => {
    const handler = handlers['search_content']
    const result = await handler({ query: 'DLP' }, { requestInfo: {} })
    const documents = result.structuredContent.documents

    assert.ok(documents.length > 0, 'Should return hits for DLP')
    const article = documents.find(d => d.title.includes('Chrome Data Loss Prevention (DLP)'))
    assert.ok(article, 'Should find the DLP integration guide')
  })

  test('When ID is resolved via search, then get_document fetches full content', async () => {
    const searchHandler = handlers['search_content']
    const getDocHandler = handlers['get_document']

    // Search to resolve ID
    const searchResult = await searchHandler({ query: 'Licensing' }, { requestInfo: {} })
    const documents = searchResult.structuredContent.documents
    const policy = documents.find(d => d.title === 'Chrome Enterprise Premium Overview and Implementation')
    assert.ok(policy, 'Should fetch match to resolve ID')

    // Fetch full body
    const docResult = await getDocHandler({ filename: policy.filename }, { requestInfo: {} })
    const docText = docResult.content[0].text

    assert.ok(docText.includes('Chrome Enterprise Premium'), 'Full content should include the policy text')
  })

  test('When searched for configurable timeouts, then search_content finds the dedicated article', async () => {
    const searchHandler = handlers['search_content']
    const getDocHandler = handlers['get_document']

    const searchResult = await searchHandler({ query: 'timeout deadline' }, { requestInfo: {} })
    const documents = searchResult.structuredContent.documents
    const article = documents.find(d => d.title.includes('Configurable Timeout Deadlines'))
    assert.ok(article, 'Should find the configurable timeouts article')

    const docResult = await getDocHandler({ filename: article.filename }, { requestInfo: {} })
    const docText = docResult.content[0].text
    assert.ok(docText.includes('Deep scanning protection settings'), 'Should include exact UI path grounding')
  })

  test('When searched for Evidence Locker paste, then search_content finds the evidence locker article', async () => {
    const searchHandler = handlers['search_content']
    const searchResult = await searchHandler({ query: 'Evidence Locker paste' }, { requestInfo: {} })
    const documents = searchResult.structuredContent.documents
    const article = documents.find(d => d.title.includes('Evidence Locker'))
    assert.ok(article, 'Should find the Evidence Locker setup guide')
  })
})
