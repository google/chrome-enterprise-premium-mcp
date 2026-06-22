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

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createIntegrationHarness, teardownIntegrationHarness } from '../../helpers/integration/tools/harness.js'
import { parseToolOutput } from '../../helpers/integration/tools/tool_utils.js'

describe('Search Organizations Tool Integration', () => {
  let harness
  const createdResources = []

  before(async () => {
    harness = await createIntegrationHarness()
  })

  after(async () => {
    await teardownIntegrationHarness(harness, createdResources)
  })

  test('When search_organizations is called, then it returns the associated organization and caches it in sessionState', async () => {
    const { client, testContext, sessionState } = harness

    const result = await client.callTool({
      name: 'search_organizations',
      arguments: {
        customerId: testContext.customerId,
      },
    })

    const { text, details } = parseToolOutput(result)

    // Verify output text contains key details
    assert.ok(text.includes('Associated GCP Organization Found'), `Output text: ${text}`)
    assert.ok(text.includes('Test Org'), `Output text: ${text}`)
    assert.ok(text.includes('123456789'), `Output text: ${text}`)

    // Verify raw details in structured content
    assert.strictEqual(details.organizations[0].displayName, 'Test Org')
    assert.strictEqual(details.organizations[0].name, 'organizations/123456789')

    // Verify sessionState was updated
    assert.strictEqual(sessionState.organizationId, '123456789')
    assert.strictEqual(sessionState.organizationName, 'organizations/123456789')
  })
})
