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

describe('Access Levels Tool Integration', () => {
  let harness
  const createdResources = []

  before(async () => {
    process.env.EXPERIMENT_ACM_TOOLS_ENABLED = 'true'
    harness = await createIntegrationHarness()
  })

  after(async () => {
    delete process.env.EXPERIMENT_ACM_TOOLS_ENABLED
    await teardownIntegrationHarness(harness, createdResources)
  })

  test('When list_caa_access_levels is called with organizationId, then it resolves policy and lists levels', async () => {
    const { client, fakeServer } = harness

    fakeServer.mergeFixture({
      accessPolicies: {
        'accessPolicies/10001': {
          name: 'accessPolicies/10001',
          parent: 'organizations/123456789',
          title: 'Org 123456789 Policy',
        },
      },
      accessLevels: {
        'accessPolicies/10001/accessLevels/level_1': {
          name: 'accessPolicies/10001/accessLevels/level_1',
          title: 'High Security Level',
          description: 'Requires screenlock and corp ownership',
          basic: {
            conditions: [
              {
                devicePolicy: {
                  requireScreenlock: true,
                  requireCorpOwned: true,
                },
              },
            ],
          },
        },
      },
    })

    const result = await client.callTool({
      name: 'list_caa_access_levels',
      arguments: {
        organizationId: '123456789',
      },
    })

    const { text, details } = parseToolOutput(result)

    assert.ok(text.includes('Access Levels'), `Output text: ${text}`)
    assert.ok(text.includes('High Security Level'), `Output text: ${text}`)
    assert.ok(text.includes('accessPolicies/10001/accessLevels/level_1'), `Output text: ${text}`)
    assert.ok(Array.isArray(details.accessLevels), 'accessLevels should be an array')
    assert.strictEqual(details.accessLevels.length, 1)
    assert.strictEqual(details.accessLevels[0].title, 'High Security Level')
  })
})
