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

describe('Connector Enablement Integration', () => {
  let harness
  const createdResources = []

  before(async () => {
    harness = await createIntegrationHarness()
  })

  after(async () => {
    await teardownIntegrationHarness(harness, createdResources)
  })

  test('Enable All Connectors: Batch Enable -> Verify Skip', async () => {
    const { client, testContext } = harness
    const connectors = [
      'PRINT',
      'BULK_TEXT_ENTRY',
      'FILE_DOWNLOAD',
      'FILE_UPLOAD',
      'REALTIME_URL_CHECK',
      'ON_SECURITY_EVENT',
    ]

    const args = {
      customerId: testContext.customerId,
      orgUnitId: testContext.orgUnitId,
      connectors: connectors,
    }

    // 1. INITIAL BATCH ENABLE
    const result = await client.callTool({
      name: 'enable_chrome_enterprise_connectors',
      arguments: args,
    })

    const { text } = parseToolOutput(result)
    // Verify each connector is mentioned
    connectors.forEach(c => {
      assert.ok(text.includes(c) || text.includes('configured'), `Connector ${c} not mentioned in output: ${text}`)
    })

    // 2. VERIFY SKIP LOGIC (Second Batch Call)
    const secondResult = await client.callTool({
      name: 'enable_chrome_enterprise_connectors',
      arguments: args,
    })

    const { text: secondText } = parseToolOutput(secondResult)
    connectors.forEach(c => {
      assert.match(secondText, /already configured/, `Connector ${c} should have been skipped in second call`)
    })
  })

  test('Partial Enablement: Mixing configured and unconfigured', async () => {
    const { client, testContext } = harness

    // We assume some might be enabled from the previous test.
    // Let's pick just one to enable if it wasn't already.
    const connectors = ['PRINT', 'BULK_TEXT_ENTRY', 'ON_SECURITY_EVENT']
    const args = {
      customerId: testContext.customerId,
      orgUnitId: testContext.orgUnitId,
      connectors: connectors,
    }

    const result = await client.callTool({
      name: 'enable_chrome_enterprise_connectors',
      arguments: args,
    })

    const { text } = parseToolOutput(result)
    // Should mention all requested
    assert.ok(text.includes('Print Analysis'), 'Print Analysis should be mentioned')
    assert.ok(text.includes('Bulk Text Entry'), 'Bulk Text Entry should be mentioned')
    assert.ok(text.includes('Event Reporting'), 'Event Reporting should be mentioned')
  })

  test('ON_SECURITY_EVENT: Verify enablement output', async () => {
    const { client, testContext } = harness

    const result = await client.callTool({
      name: 'enable_chrome_enterprise_connectors',
      arguments: {
        customerId: testContext.customerId,
        orgUnitId: testContext.orgUnitId,
        connectors: ['ON_SECURITY_EVENT'],
      },
    })

    const { text } = parseToolOutput(result)
    assert.ok(
      text.includes('Event Reporting marked for enablement') || text.includes('Event Reporting is already configured'),
      'Event Reporting should be mentioned in the output',
    )
  })

  test('Validation: Empty connector list should fail', async () => {
    const { client, testContext } = harness

    const result = await client.callTool({
      name: 'enable_chrome_enterprise_connectors',
      arguments: {
        customerId: testContext.customerId,
        orgUnitId: testContext.orgUnitId,
        connectors: [], // Empty list
      },
    })

    assert.ok(result.isError, 'Tool result should indicate error for empty list')
    assert.match(result.content[0].text, /Array must contain at least 1 element\(s\)/)
  })

  test('Validation: Invalid connector name should fail', async () => {
    const { client, testContext } = harness

    const result = await client.callTool({
      name: 'enable_chrome_enterprise_connectors',
      arguments: {
        customerId: testContext.customerId,
        orgUnitId: testContext.orgUnitId,
        connectors: ['INVALID_CONNECTOR'],
      },
    })

    assert.ok(result.isError, 'Tool result should indicate error for invalid enum')
    assert.match(result.content[0].text, /Invalid enum value/)
  })
})
