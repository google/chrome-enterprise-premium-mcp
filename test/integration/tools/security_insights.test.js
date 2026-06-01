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

describe('Security Insights Tool Integration', () => {
  let harness
  const createdResources = []

  before(async () => {
    harness = await createIntegrationHarness()
  })

  after(async () => {
    await teardownIntegrationHarness(harness, createdResources)
  })

  test('When check action is called, then it returns the current enablement status', async () => {
    const { client, testContext } = harness

    const result = await client.callTool({
      name: 'security_insights',
      arguments: {
        action: 'check',
        customerId: testContext.customerId,
      },
    })

    const { text, details } = parseToolOutput(result)
    assert.ok(text.includes('INSIGHTS_DISABLED'), `Output should contain current status: ${text}`)
    assert.strictEqual(details.insightsState, 'INSIGHTS_DISABLED')
  })

  test('When enable action is called, then it enables the feature', async () => {
    const { client, testContext } = harness

    // Step 1: Enable Security Insights
    const enableResult = await client.callTool({
      name: 'security_insights',
      arguments: {
        action: 'enable',
        customerId: testContext.customerId,
      },
    })

    const { text: enableText, details: enableDetails } = parseToolOutput(enableResult)
    assert.ok(enableText.includes('INSIGHTS_ENABLED'), `Output should confirm enablement: ${enableText}`)
    assert.strictEqual(enableDetails.insightsState, 'INSIGHTS_ENABLED')

    // Step 2: Check status to ensure it persisted on the fake backend
    const checkResult = await client.callTool({
      name: 'security_insights',
      arguments: {
        action: 'check',
        customerId: testContext.customerId,
      },
    })

    const { text: checkText, details: checkDetails } = parseToolOutput(checkResult)
    assert.ok(checkText.includes('INSIGHTS_ENABLED'), `Output should confirm persisted status: ${checkText}`)
    assert.strictEqual(checkDetails.insightsState, 'INSIGHTS_ENABLED')
  })

  test('When enable action is called with specific targetOus, then it enables the feature', async () => {
    const { client, testContext } = harness

    const result = await client.callTool({
      name: 'security_insights',
      arguments: {
        action: 'enable',
        customerId: testContext.customerId,
        targetOus: ['/Workspace Guests'],
      },
    })

    const { text, details } = parseToolOutput(result)
    assert.ok(text.includes('INSIGHTS_ENABLED'), `Output should confirm enablement: ${text}`)
    assert.strictEqual(details.insightsState, 'INSIGHTS_ENABLED')
  })

  test('When disable action is called, then it disables the feature', async () => {
    const { client, testContext } = harness

    // Step 1: Disable Security Insights
    const disableResult = await client.callTool({
      name: 'security_insights',
      arguments: {
        action: 'disable',
        customerId: testContext.customerId,
      },
    })

    const { text: disableText, details: disableDetails } = parseToolOutput(disableResult)
    assert.ok(disableText.includes('INSIGHTS_DISABLED'), `Output should confirm disablement: ${disableText}`)
    assert.strictEqual(disableDetails.insightsState, 'INSIGHTS_DISABLED')

    // Step 2: Check status to ensure it persisted on the fake backend
    const checkResult = await client.callTool({
      name: 'security_insights',
      arguments: {
        action: 'check',
        customerId: testContext.customerId,
      },
    })

    const { text: checkText, details: checkDetails } = parseToolOutput(checkResult)
    assert.ok(checkText.includes('INSIGHTS_DISABLED'), `Output should confirm persisted status: ${checkText}`)
    assert.strictEqual(checkDetails.insightsState, 'INSIGHTS_DISABLED')
  })
})
