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
 * @file Tests for list_caa_access_levels tool handler.
 */

import assert from 'node:assert/strict'
import { describe, test, mock, beforeEach } from 'node:test'
import esmock from 'esmock'

describe('list_caa_access_levels Tool', () => {
  let server
  let mockHelpers

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
    mockHelpers = {
      formatToolResponse: ({ summary, data, structuredContent }) => ({ summary, data, structuredContent }),
    }
  })

  async function setupHandler(clientMethods, sessionState = {}) {
    const MockAcmClient = class {
      constructor() {
        Object.assign(this, clientMethods)
      }
    }

    const { registerTools } = await esmock(
      '../../tools/index.js',
      {},
      {
        '../../lib/api/access_context_manager_client.js': {
          AccessContextManagerClient: MockAcmClient,
        },
        '../../tools/utils/wrapper.js': {
          guardedToolCall: handlerConfig => handlerConfig.handler,
          formatToolResponse: mockHelpers.formatToolResponse,
        },
      },
    )

    registerTools(
      server,
      {
        apiClients: { accessContextManager: new MockAcmClient() },
        featureFlags: {
          isEnabled: flag => flag === 'ACM_TOOLS_ENABLED',
        },
      },
      sessionState,
    )

    const registerCall = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_caa_access_levels')
    if (!registerCall) {
      throw new Error('Tool list_caa_access_levels was not registered')
    }
    return registerCall.arguments[2]
  }

  test('When policyName is provided directly, then it lists access levels without listing policies', async () => {
    const mockListAccessLevels = mock.fn(async () => ({
      accessLevels: [
        {
          name: 'accessPolicies/999/accessLevels/level_1',
          title: 'Corporate Desktop',
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
      ],
    }))
    const mockListAccessPolicies = mock.fn()

    const handler = await setupHandler({
      listAccessLevels: mockListAccessLevels,
      listAccessPolicies: mockListAccessPolicies,
    })

    const result = await handler(
      {
        policyName: 'accessPolicies/999',
      },
      { authToken: 'mock-token' },
    )

    assert.strictEqual(mockListAccessPolicies.mock.callCount(), 0)
    assert.strictEqual(mockListAccessLevels.mock.callCount(), 1)
    assert.strictEqual(mockListAccessLevels.mock.calls[0].arguments[0], 'accessPolicies/999')

    assert.ok(result.summary.includes('## Access Levels (1)'))
    assert.ok(result.summary.includes('**Corporate Desktop** (`accessPolicies/999/accessLevels/level_1`)'))
    assert.ok(result.summary.includes('Screenlock; Corp Owned'))
    assert.strictEqual(result.data.accessLevels.length, 1)
  })

  test('When organizationId is provided, then it lists policies first and uses the policy name to list levels', async () => {
    const mockListAccessPolicies = mock.fn(async () => ({
      accessPolicies: [{ name: 'accessPolicies/resolved_123' }],
    }))
    const mockListAccessLevels = mock.fn(async () => ({
      accessLevels: [
        {
          name: 'accessPolicies/resolved_123/accessLevels/custom_level',
          title: 'Custom Level',
          custom: {
            expr: {
              expression: 'request.auth.claims.email.endsWith("@example.com")',
            },
          },
        },
      ],
    }))

    const handler = await setupHandler({
      listAccessPolicies: mockListAccessPolicies,
      listAccessLevels: mockListAccessLevels,
    })

    const result = await handler(
      {
        organizationId: '123456789',
      },
      { authToken: 'mock-token' },
    )

    assert.strictEqual(mockListAccessPolicies.mock.callCount(), 1)
    assert.strictEqual(mockListAccessPolicies.mock.calls[0].arguments[0].parent, 'organizations/123456789')
    assert.strictEqual(mockListAccessLevels.mock.callCount(), 1)
    assert.strictEqual(mockListAccessLevels.mock.calls[0].arguments[0], 'accessPolicies/resolved_123')
    assert.ok(result.summary.includes('Custom CEL'))
    assert.strictEqual(result.data.accessLevels.length, 1)
  })

  test('When organizationId is cached in sessionState, then it uses cached org ID', async () => {
    const mockListAccessPolicies = mock.fn(async () => ({
      accessPolicies: [{ name: 'accessPolicies/cached_policy' }],
    }))
    const mockListAccessLevels = mock.fn(async () => ({
      accessLevels: [],
    }))

    const handler = await setupHandler(
      {
        listAccessPolicies: mockListAccessPolicies,
        listAccessLevels: mockListAccessLevels,
      },
      { organizationId: '987654321' },
    )

    const result = await handler({}, { authToken: 'mock-token' })

    assert.strictEqual(mockListAccessPolicies.mock.callCount(), 1)
    assert.strictEqual(mockListAccessPolicies.mock.calls[0].arguments[0].parent, 'organizations/987654321')
    assert.ok(result.summary.includes('No Access Levels found in policy `accessPolicies/cached_policy`'))
  })

  test('When no Access Policy is found for the organization, then it returns graceful empty message', async () => {
    const mockListAccessPolicies = mock.fn(async () => ({
      accessPolicies: [],
    }))

    const handler = await setupHandler({
      listAccessPolicies: mockListAccessPolicies,
    })

    const result = await handler({ organizationId: '55555' }, { authToken: 'mock-token' })

    assert.ok(result.summary.includes('No Access Policy found for organization "organizations/55555"'))
    assert.deepStrictEqual(result.data.accessLevels, [])
  })

  test('When neither policyName nor organizationId is provided/cached, then it throws an error', async () => {
    const handler = await setupHandler({})

    await assert.rejects(() => handler({}, { authToken: 'mock-token' }), /Organization ID is required/)
  })

  test('When nextPageToken is returned by API, then it includes token notice in summary', async () => {
    const mockListAccessLevels = mock.fn(async () => ({
      accessLevels: [
        {
          name: 'accessPolicies/123/accessLevels/lvl1',
          title: 'L1',
        },
      ],
      nextPageToken: 'token_abc123',
    }))

    const handler = await setupHandler({
      listAccessLevels: mockListAccessLevels,
    })

    const result = await handler({ policyName: 'accessPolicies/123' }, { authToken: 'mock-token' })

    assert.ok(result.summary.includes('pageToken: `token_abc123`'))
    assert.strictEqual(result.data.nextPageToken, 'token_abc123')
  })
})
