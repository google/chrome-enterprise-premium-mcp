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

import assert from 'node:assert/strict'
import { describe, test, mock, beforeEach } from 'node:test'
import { registerTools } from '../../tools/index.js'
import { FeatureFlags } from '../../lib/util/feature_flags.js'
import { registerSecurityInsightsDataTool } from '../../tools/definitions/security_insights_data_tool.js'

describe('security_insights_data Tool', () => {
  let server

  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }
  })

  describe('Feature Flag Gating', () => {
    test('When EXPERIMENT_SECURITY_INSIGHTS_DATA_TOOL_ENABLED flag is enabled, then it registers the tool', () => {
      const flags = new FeatureFlags({ EXPERIMENT_SECURITY_INSIGHTS_DATA_TOOL_ENABLED: 'true' })
      registerTools(server, { featureFlags: flags })

      const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
      assert.ok(
        registeredToolNames.includes('security_insights_data'),
        'security_insights_data tool should be registered when flag is enabled',
      )
    })

    test('When EXPERIMENT_SECURITY_INSIGHTS_DATA_TOOL_ENABLED flag is disabled, then it does NOT register the tool', () => {
      const flags = new FeatureFlags({ EXPERIMENT_SECURITY_INSIGHTS_DATA_TOOL_ENABLED: 'false' })
      registerTools(server, { featureFlags: flags })

      const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
      assert.ok(
        !registeredToolNames.includes('security_insights_data'),
        'security_insights_data tool should NOT be registered when flag is disabled',
      )
    })
  })

  describe('Handler Logic', () => {
    let mockClient
    let handler
    const customerId = 'C0123'

    beforeEach(() => {
      mockClient = {
        queryContentTransfers: mock.fn(async () => ({
          summaries: [{ metric: 'CONTENT_TRANSFERS_METRIC_TOTAL_TRANSFERS', count: '100' }],
        })),
        queryContentTransfersBreakdowns: mock.fn(async () => ({
          contentTransfersBreakdowns: [{ user: 'user@test.com', summary: { count: '50' } }],
        })),
        queryUrlVisits: mock.fn(async () => ({
          summaries: [{ metric: 'URL_VISITS_METRIC_TOTAL_SUSPICIOUS_URL_VISITS', count: '5' }],
        })),
        queryUrlVisitsBreakdowns: mock.fn(async () => ({
          urlVisitsBreakdowns: [{ user: 'user@test.com', summary: { count: '2' } }],
        })),
      }

      const options = {
        chromeManagementClient: mockClient,
        apiClients: {
          adminSdk: {
            getCustomerId: mock.fn(async () => ({ id: customerId })),
          },
        },
      }

      registerSecurityInsightsDataTool(server, options, { customerId: null })
      handler = server.registerTool.mock.calls[0].arguments[2]
    })

    test('When queryContentTransfers is called, then it calls API and returns formatted summaries', async () => {
      const result = await handler(
        { action: 'queryContentTransfers', customerId, filter: 'event_time >= "2026-01-01T00:00:00Z"' },
        { requestInfo: {} },
      )

      assert.strictEqual(mockClient.queryContentTransfers.mock.callCount(), 1)
      const callArgs = mockClient.queryContentTransfers.mock.calls[0].arguments
      assert.strictEqual(callArgs[0], customerId)
      assert.deepStrictEqual(callArgs[1], { filter: 'event_time >= "2026-01-01T00:00:00Z"' })

      assert.ok(result.content[0].text.includes('Security Insights action `queryContentTransfers` completed.'))
      assert.ok(result.content[0].text.includes('Found 1 summaries.'))
      assert.deepStrictEqual(result.structuredContent.summaries[0].count, '100')
    })

    test('When queryContentTransfers is called with breakdown parameters, then it filters them out and calls API with only filter', async () => {
      await handler(
        {
          action: 'queryContentTransfers',
          customerId,
          filter: 'event_time >= "2026-01-01T00:00:00Z"',
          pageSize: 10,
          breakdown: 'USER',
        },
        { requestInfo: {} },
      )

      assert.strictEqual(mockClient.queryContentTransfers.mock.callCount(), 1)
      const callArgs = mockClient.queryContentTransfers.mock.calls[0].arguments
      assert.strictEqual(callArgs[0], customerId)
      assert.deepStrictEqual(callArgs[1], { filter: 'event_time >= "2026-01-01T00:00:00Z"' })
    })

    test('When queryContentTransfersBreakdowns is called, then it calls API and returns formatted breakdowns', async () => {
      const result = await handler(
        {
          action: 'queryContentTransfersBreakdowns',
          customerId,
          pageSize: 10,
          breakdown: 'USER',
          fixedTimeRange: 'FIXED_TIME_RANGE_ONE_WEEK',
        },
        { requestInfo: {} },
      )

      assert.strictEqual(mockClient.queryContentTransfersBreakdowns.mock.callCount(), 1)
      const callArgs = mockClient.queryContentTransfersBreakdowns.mock.calls[0].arguments
      assert.strictEqual(callArgs[0], customerId)
      assert.deepStrictEqual(callArgs[1], {
        pageSize: 10,
        breakdown: 'USER',
        fixedTimeRange: 'FIXED_TIME_RANGE_ONE_WEEK',
      })

      assert.ok(
        result.content[0].text.includes('Security Insights action `queryContentTransfersBreakdowns` completed.'),
      )
      assert.ok(result.content[0].text.includes('Found 1 breakdowns.'))
      assert.deepStrictEqual(result.structuredContent.contentTransfersBreakdowns[0].user, 'user@test.com')
    })

    test('When queryUrlVisits is called, then it calls API and returns formatted summaries', async () => {
      const result = await handler({ action: 'queryUrlVisits', customerId }, { requestInfo: {} })

      assert.strictEqual(mockClient.queryUrlVisits.mock.callCount(), 1)
      assert.strictEqual(mockClient.queryUrlVisits.mock.calls[0].arguments[0], customerId)

      assert.ok(result.content[0].text.includes('Security Insights action `queryUrlVisits` completed.'))
      assert.deepStrictEqual(result.structuredContent.summaries[0].count, '5')
    })

    test('When queryUrlVisits is called with breakdown parameters, then it filters them out and calls API with only empty options', async () => {
      await handler(
        {
          action: 'queryUrlVisits',
          customerId,
          pageSize: 10,
          breakdown: 'USER',
        },
        { requestInfo: {} },
      )

      assert.strictEqual(mockClient.queryUrlVisits.mock.callCount(), 1)
      const callArgs = mockClient.queryUrlVisits.mock.calls[0].arguments
      assert.strictEqual(callArgs[0], customerId)
      assert.deepStrictEqual(callArgs[1], {})
    })

    test('When queryUrlVisitsBreakdowns is called, then it calls API and returns formatted breakdowns', async () => {
      const result = await handler(
        { action: 'queryUrlVisitsBreakdowns', customerId, breakdown: 'EVENT_DOMAIN' },
        { requestInfo: {} },
      )

      assert.strictEqual(mockClient.queryUrlVisitsBreakdowns.mock.callCount(), 1)
      const callArgs = mockClient.queryUrlVisitsBreakdowns.mock.calls[0].arguments
      assert.strictEqual(callArgs[0], customerId)
      assert.deepStrictEqual(callArgs[1], { breakdown: 'EVENT_DOMAIN' })

      assert.ok(result.content[0].text.includes('Security Insights action `queryUrlVisitsBreakdowns` completed.'))
      assert.deepStrictEqual(result.structuredContent.urlVisitsBreakdowns[0].user, 'user@test.com')
    })

    test('When customerId is omitted, then it resolves it using adminSdk', async () => {
      // We need to trigger resolution, which happens in guardedToolCall.
      // So we must use a handler that was registered with the full registerTools flow,
      // or manually trigger guardedToolCall logic.
      // Actually, since we mocked registerSecurityInsightsDataTool with options containing apiClients,
      // guardedToolCall will call options.apiClients.adminSdk.getCustomerId if customerId is undefined.
      await handler({ action: 'queryContentTransfers' }, { requestInfo: {} })

      assert.strictEqual(mockClient.queryContentTransfers.mock.callCount(), 1)
      // The resolved customerId 'C0123' should be passed to the API client
      assert.strictEqual(mockClient.queryContentTransfers.mock.calls[0].arguments[0], customerId)
    })
  })
})
