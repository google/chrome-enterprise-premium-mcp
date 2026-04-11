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
*/ import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { registerKnowledgeTools } from '../../tools/definitions/knowledge.js'

describe('Knowledge Tools Real Database Integration', () => {
  const handlers = {}
  const server = {
    registerTool: (name, description, handler) => {
      handlers[name] = handler
    },
  }

  // Register tools using the default construction path (lib/knowledge directory)
  registerKnowledgeTools(server, {}, {})

  it('should find Licensing policy via search_content', async () => {
    const handler = handlers['search_content']
    assert.ok(handler, 'search_content handler should be registered')

    const result = await handler({ query: 'Licensing' }, { requestInfo: {} })
    const documents = result.structuredContent.documents

    assert.ok(documents.length > 0, 'Should return at least one document')

    // Look for Chrome Enterprise Premium Product & Licensing Overview
    const policy = documents.find(d => d.title === 'Chrome Enterprise Premium Product & Licensing Overview')
    assert.ok(policy, 'Should find Chrome Enterprise Premium Product & Licensing Overview policy')
    assert.ok(policy.id, 'Found policy should have an ID')
  })

  it('should find DLP integration articles via search_content', async () => {
    const handler = handlers['search_content']
    const result = await handler({ query: 'DLP' }, { requestInfo: {} })
    const documents = result.structuredContent.documents

    assert.ok(documents.length > 0, 'Should return hits for DLP')
    const article = documents.find(d => d.title.includes('Chrome Data Loss Prevention (DLP)'))
    assert.ok(article, 'Should find the DLP integration guide')
  })

  it('should dynamically resolve ID and fetch full document via get_document', async () => {
    const searchHandler = handlers['search_content']
    const getDocHandler = handlers['get_document']

    // Search to resolve ID
    const searchResult = await searchHandler({ query: 'Licensing' }, { requestInfo: {} })
    const documents = searchResult.structuredContent.documents
    const policy = documents.find(d => d.title === 'Chrome Enterprise Premium Product & Licensing Overview')
    assert.ok(policy, 'Should fetch match to resolve ID')

    // Fetch full body
    const docResult = await getDocHandler({ kind: policy.kind, filename: policy.filename }, { requestInfo: {} })
    const docText = docResult.content[0].text

    assert.ok(docText.includes('Chrome Enterprise Premium'), 'Full content should include the policy text')
  })
})
