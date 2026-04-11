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

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createIntegrationHarness, teardownIntegrationHarness } from '../../helpers/integration/tools/harness.js'

describe('Diagnose Environment Integration', () => {
  let harness

  before(async () => {
    harness = await createIntegrationHarness()
  })

  after(async () => {
    await teardownIntegrationHarness(harness, [])
  })

  test('summary mode returns counts and issues, not raw arrays', async () => {
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
  })

  test('issues are deterministic across calls', async () => {
    const { client } = harness
    const r1 = await client.callTool({ name: 'diagnose_environment', arguments: {} })
    const r2 = await client.callTool({ name: 'diagnose_environment', arguments: {} })
    assert.deepStrictEqual(r1.structuredContent.issues, r2.structuredContent.issues)
  })

  test('detail mode paginates orgUnits', async () => {
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

  test('detail mode paginates dlpRules', async () => {
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

  test('summary text has no internal API identifiers', async () => {
    const { client } = harness
    const result = await client.callTool({ name: 'diagnose_environment', arguments: {} })
    const text = result.content[0].text

    assert.ok(text.includes('Health Check'), 'Has header')
    assert.ok(!text.includes('SERVICE_PROVIDER_'), 'No raw enum')
    assert.ok(!text.includes('settings/rule.dlp'), 'No raw setting type')
    assert.ok(!text.includes('google.workspace.chrome'), 'No raw trigger')
  })

  test('connector status is checked for all 6 types', async () => {
    const { client } = harness
    const result = await client.callTool({ name: 'diagnose_environment', arguments: {} })
    const connectors = result.structuredContent.connectors
    const keys = Object.keys(connectors)
    assert.ok(keys.length === 6, `Expected 6 connectors, got ${keys.length}`)
    for (const key of keys) {
      assert.ok(typeof connectors[key].configured === 'boolean', `${key} has boolean configured`)
    }
  })
})
