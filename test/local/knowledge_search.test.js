import { describe, it } from 'node:test'
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

    const result = await handler({ query: 'Licensing', kind: 'curated' }, { requestInfo: {} })
    const documents = result.structuredContent.documents

    assert.ok(documents.length > 0, 'Should return at least one document')

    // Look for Chrome Enterprise Premium Product & Licensing Overview
    const policy = documents.find(d => d.title === 'Chrome Enterprise Premium Product & Licensing Overview')
    assert.ok(policy, 'Should find Chrome Enterprise Premium Product & Licensing Overview policy')
    assert.ok(policy.id, 'Found policy should have an ID')
  })

  it('should find DLP integration articles via search_content', async () => {
    const handler = handlers['search_content']
    const result = await handler({ query: 'DLP', kind: 'curated' }, { requestInfo: {} })
    const documents = result.structuredContent.documents

    assert.ok(documents.length > 0, 'Should return hits for DLP')
    const article = documents.find(d => d.title.includes('Chrome Data Loss Prevention (DLP)'))
    assert.ok(article, 'Should find the DLP integration guide')
  })

  it('should dynamically resolve ID and fetch full document via get_document', async () => {
    const searchHandler = handlers['search_content']
    const getDocHandler = handlers['get_document']

    // 1. Search to resolve ID
    const searchResult = await searchHandler({ query: 'Licensing' }, { requestInfo: {} })
    const documents = searchResult.structuredContent.documents
    const policy = documents.find(d => d.title === 'Chrome Enterprise Premium Product & Licensing Overview')
    assert.ok(policy, 'Should fetch match to resolve ID')

    // 2. Fetch full body
    const docResult = await getDocHandler({ kind: policy.kind, filename: policy.filename }, { requestInfo: {} })
    const docText = docResult.content[0].text

    assert.ok(docText.includes('Chrome Enterprise Premium'), 'Full content should include the policy text')
  })
})
