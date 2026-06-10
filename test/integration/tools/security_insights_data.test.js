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
import { FeatureFlags } from '../../../lib/util/feature_flags.js'

describe('Security Insights Data Tool Integration', () => {
  let harness
  const createdResources = []

  before(async () => {
    // Enable the feature flag for the integration test harness
    const featureFlags = new FeatureFlags({ EXPERIMENT_SECURITY_INSIGHTS_DATA_TOOL_ENABLED: 'true' })
    harness = await createIntegrationHarness({ featureFlags })
  })

  after(async () => {
    await teardownIntegrationHarness(harness, createdResources)
  })

  test('When queryContentTransfers action is called, then it returns the content transfers summary', async () => {
    const { client, testContext } = harness

    const result = await client.callTool({
      name: 'security_insights_data',
      arguments: {
        action: 'queryContentTransfers',
        customerId: testContext.customerId,
        filter: 'event_time >= "2024-01-01T00:00:00Z"',
      },
    })

    const { text, details } = parseToolOutput(result)
    assert.ok(text.includes('Security Insights action `queryContentTransfers` completed.'), `Output text: ${text}`)
    assert.ok(text.includes('Found 1 summaries.'), `Output text: ${text}`)
    assert.deepStrictEqual(details.summaries[0], {
      metric: 'CONTENT_TRANSFERS_METRIC_TOTAL_TRANSFERS',
      count: '100',
    })
  })

  test('When queryContentTransfersBreakdowns action is called, then it returns content transfers breakdowns', async () => {
    const { client, testContext } = harness

    const result = await client.callTool({
      name: 'security_insights_data',
      arguments: {
        action: 'queryContentTransfersBreakdowns',
        customerId: testContext.customerId,
        pageSize: 10,
        breakdown: 'USER',
      },
    })

    const { text, details } = parseToolOutput(result)
    assert.ok(
      text.includes('Security Insights action `queryContentTransfersBreakdowns` completed.'),
      `Output text: ${text}`,
    )
    assert.ok(text.includes('Found 1 breakdowns.'), `Output text: ${text}`)
    assert.deepStrictEqual(details.contentTransfersBreakdowns[0], {
      user: 'user@test.com',
      summary: { count: '50' },
    })
  })

  test('When queryUrlVisits action is called, then it returns URL visits summary', async () => {
    const { client, testContext } = harness

    const result = await client.callTool({
      name: 'security_insights_data',
      arguments: {
        action: 'queryUrlVisits',
        customerId: testContext.customerId,
      },
    })

    const { text, details } = parseToolOutput(result)
    assert.ok(text.includes('Security Insights action `queryUrlVisits` completed.'), `Output text: ${text}`)
    assert.ok(text.includes('Found 1 summaries.'), `Output text: ${text}`)
    assert.deepStrictEqual(details.summaries[0], {
      metric: 'URL_VISITS_METRIC_TOTAL_SUSPICIOUS_URL_VISITS',
      count: '5',
    })
  })

  test('When queryUrlVisitsBreakdowns action is called, then it returns URL visits breakdowns', async () => {
    const { client, testContext } = harness

    const result = await client.callTool({
      name: 'security_insights_data',
      arguments: {
        action: 'queryUrlVisitsBreakdowns',
        customerId: testContext.customerId,
        breakdown: 'EVENT_DOMAIN',
      },
    })

    const { text, details } = parseToolOutput(result)
    assert.ok(text.includes('Security Insights action `queryUrlVisitsBreakdowns` completed.'), `Output text: ${text}`)
    assert.ok(text.includes('Found 1 breakdowns.'), `Output text: ${text}`)
    assert.deepStrictEqual(details.urlVisitsBreakdowns[0], {
      user: 'user@test.com',
      summary: { count: '2' },
    })
  })
})
