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

/**
 * @fileoverview Integration test for diagnose_environment tool.
 *
 * Tests summary mode, detail/pagination mode, issue detection,
 * and response formatting through the full MCP harness.
 */

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createIntegrationHarness, teardownIntegrationHarness } from '../../helpers/integration/tools/harness.js'

const EXPECTED_CONNECTOR_COUNT = 6

describe('Diagnose Environment Integration', () => {
  let harness

  before(async () => {
    harness = await createIntegrationHarness()
  })

  after(async () => {
    await teardownIntegrationHarness(harness, [])
  })

  test(
    'When summary mode is requested, then it returns counts and issues, not raw arrays',
    { skip: process.env.SKIP_SLOW === 'true' },
    async () => {
      const { client } = harness
      const result = await client.callTool({ name: 'diagnose_environment', arguments: {} })
      const sc = result.structuredContent

      assert.ok(sc.customer.customerId, 'Customer ID resolved')
      assert.ok(typeof sc.orgUnitCount === 'number', 'Org unit count is a number')
      assert.ok(typeof sc.subscription.isActive === 'boolean', 'Subscription status is boolean')
      assert.ok(typeof sc.subscription.assignmentCount === 'number', 'License count is a number')
      assert.ok(typeof sc.dlpRules.total === 'number', 'DLP rule count is a number')
      assert.ok(typeof sc.dlpRules.active === 'number', 'Active rule count')
      assert.ok(typeof sc.detectors.total === 'number', 'Detector count is a number')
      assert.ok(typeof sc.browserVersions.total === 'number', 'Browser version count')
      assert.ok(typeof sc.browserVersions.deviceCount === 'number', 'Device count')
      assert.ok(Array.isArray(sc.issues), 'Issues is an array')

      // Summary should NOT contain raw OU or rule arrays
      assert.ok(!Array.isArray(sc.orgUnits), 'No orgUnits array in summary')
      assert.ok(!Array.isArray(sc.dlpRulesList), 'No raw rules array in summary')

      // Added determinism check to save a tool call!
      const result2 = await client.callTool({ name: 'diagnose_environment', arguments: {} })
      assert.deepStrictEqual(sc.issues, result2.structuredContent.issues)
    },
  )

  test('When summary text is generated, then it has no internal API identifiers', async () => {
    const { client } = harness
    const result = await client.callTool({ name: 'diagnose_environment', arguments: {} })
    const text = result.content[0].text

    assert.ok(text.includes('Health Check'), 'Has header')
    assert.ok(!text.includes('SERVICE_PROVIDER_'), 'No raw enum')
    assert.ok(!text.includes('settings/rule.dlp'), 'No raw setting type')
    assert.ok(!text.includes('google.workspace.chrome'), 'No raw trigger')
  })

  test('When connector status is checked, then all 6 types are verified', async () => {
    const { client } = harness
    const result = await client.callTool({ name: 'diagnose_environment', arguments: {} })
    const connectors = result.structuredContent.connectors
    const keys = Object.keys(connectors)

    assert.ok(
      keys.length === EXPECTED_CONNECTOR_COUNT,
      `Expected ${EXPECTED_CONNECTOR_COUNT} connectors, got ${keys.length}`,
    )

    assert.ok(typeof connectors['printAnalysis'].configured === 'boolean', 'printAnalysis has boolean configured')
    assert.ok(typeof connectors['pasteAnalysis'].configured === 'boolean', 'pasteAnalysis has boolean configured')
    assert.ok(typeof connectors['downloadAnalysis'].configured === 'boolean', 'downloadAnalysis has boolean configured')
    assert.ok(typeof connectors['uploadAnalysis'].configured === 'boolean', 'uploadAnalysis has boolean configured')
    assert.ok(typeof connectors['realtimeUrlCheck'].configured === 'boolean', 'realtimeUrlCheck has boolean configured')
    assert.ok(
      typeof connectors['securityEventReporting'].configured === 'boolean',
      'securityEventReporting has boolean configured',
    )
  })

  test('When detail mode is requested for orgUnits, then it returns paginated results', { skip: process.env.SKIP_SLOW === 'true' }, async () => {
    const { client } = harness
    const page1 = await client.callTool({
      name: 'diagnose_environment',
      arguments: { section: 'orgUnits', limit: 2, offset: 0 },
    })
    const sc = page1.structuredContent
    assert.ok(sc.section === 'orgUnits', 'Section is orgUnits')
    assert.ok(Array.isArray(sc.items), 'Items is an array')
    assert.ok(sc.items.length <= 2, 'Respects limit')
    assert.ok(typeof sc.total === 'number', 'Has total count')
    assert.ok(typeof sc.hasMore === 'boolean', 'Has hasMore flag')
  })

  test('When detail mode is requested for dlpRules, then it returns paginated results', { skip: process.env.SKIP_SLOW === 'true' }, async () => {
    const { client } = harness
    const result = await client.callTool({
      name: 'diagnose_environment',
      arguments: { section: 'dlpRules', limit: 1, offset: 0 },
    })
    const sc = result.structuredContent
    assert.ok(sc.section === 'dlpRules')
    assert.ok(sc.items.length <= 1, 'Respects limit=1')
    if (sc.items.length > 0) {
      assert.ok(sc.items[0].displayName, 'Rule has display name')
      assert.ok(sc.items[0].actionType, 'Rule has action type')
    }
  })
})
