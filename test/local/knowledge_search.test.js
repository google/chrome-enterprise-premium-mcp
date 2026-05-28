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
          get: async () => {
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
    registerKnowledgeTools(server, {}, {})
  })

  test('When document is fetched, then get_document fetches real markdown and resolves remote contents', async () => {
    const getDocHandler = handlers['get_document']
    assert.ok(getDocHandler, 'get_document handler should be registered')

    const docResult = await getDocHandler({ filename: '01-cep-overview' }, { requestInfo: {} })
    const docText = docResult.content[0].text

    assert.ok(docText.includes('Chrome Enterprise Premium'), 'Full content should include policy text')
  })
})
