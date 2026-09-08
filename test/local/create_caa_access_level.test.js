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
 * @file Tests for create_caa_access_level tool handler.
 */

import assert from 'node:assert/strict'
import { describe, test, mock, beforeEach } from 'node:test'
import esmock from 'esmock'

describe('create_caa_access_level Tool', () => {
  let server
  let mockHelpers

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
    mockHelpers = {
      guardedToolCall: fn => fn, // bypass wrapper for easier testing of handler
      formatToolResponse: ({ summary, data }) => ({ summary, data }),
    }
  })

  async function setupHandler(clientMethods, sessionState = {}) {
    const MockAcmClient = class {
      constructor() {
        Object.assign(this, clientMethods)
      }
    }

    // We need to mock the wrapper.js to return the handler directly,
    // otherwise we have to mock the whole auth flow.
    const { registerTools } = await esmock(
      '../../tools/index.js',
      {},
      {
        '../../lib/api/access_context_manager_client.js': {
          AccessContextManagerClient: MockAcmClient,
        },
        '../../tools/utils/wrapper.js': {
          guardedToolCall: handlerConfig => {
            const h = handlerConfig.handler
            h.isMutating = handlerConfig.isMutating
            return h
          },
          formatToolResponse: mockHelpers.formatToolResponse,
        },
      },
    )

    registerTools(
      server,
      {
        apiClients: { accessContextManager: new MockAcmClient() },
        featureFlags: {
          isEnabled: flag => flag === 'ACM_TOOLS_ENABLED', // Force enable the tool
        },
      },
      sessionState,
    )

    const registerCall = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_caa_access_level')
    if (!registerCall) {
      throw new Error('Tool create_caa_access_level was not registered')
    }
    return registerCall.arguments[2]
  }

  test('When policyName is provided, then it creates access level directly without listing policies', async () => {
    const mockCreateAccessLevel = mock.fn(async () => ({ name: 'operations/create' }))
    const mockWaitForOperation = mock.fn(async () => ({
      name: 'accessPolicies/999/accessLevels/level1',
      title: 'Level 1',
      description: 'Desc',
      basic: {},
    }))
    const mockListAccessPolicies = mock.fn()

    const handler = await setupHandler({
      createAccessLevel: mockCreateAccessLevel,
      waitForOperation: mockWaitForOperation,
      listAccessPolicies: mockListAccessPolicies,
    })

    const result = await handler(
      {
        name: 'level1',
        title: 'Level 1',
        description: 'Desc',
        policyName: 'accessPolicies/999',
        requireScreenlock: true,
      },
      { authToken: 'mock-token' },
    )

    assert.strictEqual(mockListAccessPolicies.mock.callCount(), 0)
    assert.strictEqual(mockCreateAccessLevel.mock.callCount(), 1)
    const createArgs = mockCreateAccessLevel.mock.calls[0].arguments
    assert.strictEqual(createArgs[0], 'accessPolicies/999')
    assert.deepStrictEqual(createArgs[1], {
      name: 'accessPolicies/999/accessLevels/level1',
      title: 'Level 1',
      description: 'Desc',
      basic: {
        conditions: [
          {
            devicePolicy: {
              requireScreenlock: true,
              requireCorpOwned: false,
              requireAdminApproval: false,
              allowedEncryptionStatuses: [],
              osConstraints: [],
            },
          },
        ],
      },
    })
    assert.strictEqual(mockWaitForOperation.mock.callCount(), 1)
    assert.strictEqual(mockWaitForOperation.mock.calls[0].arguments[0], 'operations/create')

    assert.ok(result.summary.includes('## Access Level Created'))
    assert.ok(result.summary.includes('- **Title**: Level 1'))
    assert.ok(result.summary.includes('- **Name**: `accessPolicies/999/accessLevels/level1`'))
    assert.deepStrictEqual(result.data.accessLevel.name, 'accessPolicies/999/accessLevels/level1')
  })

  test('When organizationId is provided, then it resolves policy and creates access level', async () => {
    const mockListAccessPolicies = mock.fn(async () => ({
      accessPolicies: [{ name: 'accessPolicies/resolved_123' }],
    }))
    const mockCreateAccessLevel = mock.fn(async () => ({ name: 'operations/create' }))
    const mockWaitForOperation = mock.fn(async () => ({
      name: 'accessPolicies/resolved_123/accessLevels/level1',
      title: 'Level 1',
      basic: {},
    }))

    const handler = await setupHandler({
      listAccessPolicies: mockListAccessPolicies,
      createAccessLevel: mockCreateAccessLevel,
      waitForOperation: mockWaitForOperation,
    })

    const result = await handler(
      {
        name: 'level1',
        title: 'Level 1',
        organizationId: '12345',
        requireScreenlock: true,
      },
      { authToken: 'mock-token' },
    )

    assert.strictEqual(mockListAccessPolicies.mock.callCount(), 1)
    assert.strictEqual(mockListAccessPolicies.mock.calls[0].arguments[0].parent, 'organizations/12345')
    assert.strictEqual(mockCreateAccessLevel.mock.callCount(), 1)
    assert.strictEqual(mockCreateAccessLevel.mock.calls[0].arguments[0], 'accessPolicies/resolved_123')
    assert.deepStrictEqual(result.data.accessLevel.name, 'accessPolicies/resolved_123/accessLevels/level1')
  })

  test('When organizationId is cached, then it resolves policy using cached ID', async () => {
    const mockListAccessPolicies = mock.fn(async () => ({
      accessPolicies: [{ name: 'accessPolicies/resolved_cached' }],
    }))
    const mockCreateAccessLevel = mock.fn(async () => ({ name: 'operations/create' }))
    const mockWaitForOperation = mock.fn(async () => ({
      name: 'accessPolicies/resolved_cached/accessLevels/level1',
      title: 'Level 1',
      basic: {},
    }))

    const handler = await setupHandler(
      {
        listAccessPolicies: mockListAccessPolicies,
        createAccessLevel: mockCreateAccessLevel,
        waitForOperation: mockWaitForOperation,
      },
      { organizationId: 'cached_54321' },
    )

    const result = await handler(
      {
        name: 'level1',
        title: 'Level 1',
      },
      { authToken: 'mock-token' },
    )

    assert.strictEqual(mockListAccessPolicies.mock.callCount(), 1)
    assert.strictEqual(mockListAccessPolicies.mock.calls[0].arguments[0].parent, 'organizations/cached_54321')
    assert.deepStrictEqual(result.data.accessLevel.name, 'accessPolicies/resolved_cached/accessLevels/level1')
  })

  test('When no policy is found for organization, then it creates a new access policy and proceeds', async () => {
    const mockListAccessPolicies = mock.fn(async () => ({
      accessPolicies: [],
    }))
    const mockCreateAccessPolicy = mock.fn(async () => ({ name: 'operations/create_policy' }))
    const mockCreateAccessLevel = mock.fn(async () => ({ name: 'operations/create_level' }))
    const mockWaitForOperation = mock.fn(async opName => {
      if (opName === 'operations/create_policy') {
        return { name: 'accessPolicies/created_policy_123' }
      }
      return {
        name: 'accessPolicies/created_policy_123/accessLevels/level1',
        title: 'Level 1',
        basic: {},
      }
    })

    const handler = await setupHandler({
      listAccessPolicies: mockListAccessPolicies,
      createAccessPolicy: mockCreateAccessPolicy,
      createAccessLevel: mockCreateAccessLevel,
      waitForOperation: mockWaitForOperation,
    })

    const result = await handler(
      {
        name: 'level1',
        title: 'Level 1',
        organizationId: '12345',
      },
      { authToken: 'mock-token' },
    )

    assert.strictEqual(mockListAccessPolicies.mock.callCount(), 1)
    assert.strictEqual(mockCreateAccessPolicy.mock.callCount(), 1)
    assert.deepStrictEqual(mockCreateAccessPolicy.mock.calls[0].arguments[0], {
      parent: 'organizations/12345',
      title: 'Default Access Policy',
    })
    assert.strictEqual(mockCreateAccessLevel.mock.callCount(), 1)
    assert.strictEqual(mockCreateAccessLevel.mock.calls[0].arguments[0], 'accessPolicies/created_policy_123')
    assert.deepStrictEqual(result.data.accessLevel.name, 'accessPolicies/created_policy_123/accessLevels/level1')
  })

  test('When organizationId is missing, then it throws an error', async () => {
    const handler = await setupHandler({})

    await assert.rejects(
      () =>
        handler(
          {
            name: 'level1',
            title: 'Level 1',
          },
          { authToken: 'mock-token' },
        ),
      /Organization ID is required/,
    )
  })

  test('When complex device policy is provided, then it maps all fields correctly', async () => {
    const mockCreateAccessLevel = mock.fn(async () => ({ name: 'operations/create' }))
    const mockWaitForOperation = mock.fn(async () => ({ basic: {} }))

    const handler = await setupHandler({
      createAccessLevel: mockCreateAccessLevel,
      waitForOperation: mockWaitForOperation,
    })

    await handler(
      {
        name: 'level1',
        title: 'Level 1',
        policyName: 'accessPolicies/999',
        requireScreenlock: true,
        requireCorpOwned: true,
        requireAdminApproval: true,
        allowedEncryptionStatuses: ['ENCRYPTED'],
        osConstraints: [
          { osType: 'DESKTOP_MAC', minimumVersion: '10.15.0', requireVerifiedChromeOs: true },
          { osType: 'DESKTOP_WINDOWS', minimumVersion: '10.0.0' },
        ],
      },
      { authToken: 'mock-token' },
    )

    assert.strictEqual(mockCreateAccessLevel.mock.callCount(), 1)
    const payload = mockCreateAccessLevel.mock.calls[0].arguments[1]
    assert.deepStrictEqual(payload.basic.conditions[0].devicePolicy, {
      requireScreenlock: true,
      requireCorpOwned: true,
      requireAdminApproval: true,
      allowedEncryptionStatuses: ['ENCRYPTED'],
      osConstraints: [
        { osType: 'DESKTOP_MAC', minimumVersion: '10.15.0', requireVerifiedChromeOs: true },
        { osType: 'DESKTOP_WINDOWS', minimumVersion: '10.0.0', requireVerifiedChromeOs: undefined },
      ],
    })
  })
})
