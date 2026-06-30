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

import { describe, test, mock } from 'node:test'
import assert from 'node:assert/strict'
import esmock from 'esmock'

describe('AccessContextManagerClient', () => {
  const mockHelpers = {
    callWithRetry: async fn => fn(),
    handleApiError: err => {
      throw err
    },
  }

  test('When createAccessPolicy is called, then it calls the googleapi create method', async () => {
    const mockCreate = mock.fn(async () => ({ data: { name: 'operations/policy_create' } }))
    const mockAcm = {
      accessPolicies: {
        create: mockCreate,
      },
    }

    const { AccessContextManagerClient } = await esmock('../../lib/api/access_context_manager_client.js', {
      '../../lib/util/api-client.js': {
        createApiClient: async () => mockAcm,
      },
      '../../lib/util/helpers.js': mockHelpers,
    })

    const client = new AccessContextManagerClient()
    const policy = { parent: 'organizations/12345', title: 'Test Policy' }
    const result = await client.createAccessPolicy(policy, 'mock-token')

    assert.strictEqual(mockCreate.mock.callCount(), 1)
    const callArgs = mockCreate.mock.calls[0].arguments[0]
    assert.deepStrictEqual(callArgs.requestBody, policy)
    assert.deepStrictEqual(result, { name: 'operations/policy_create' })
  })

  test('When listAccessPolicies is called, then it calls the googleapi list method', async () => {
    const mockList = mock.fn(async () => ({ data: { accessPolicies: [] } }))
    const mockAcm = {
      accessPolicies: {
        list: mockList,
      },
    }

    const { AccessContextManagerClient } = await esmock('../../lib/api/access_context_manager_client.js', {
      '../../lib/util/api-client.js': {
        createApiClient: async () => mockAcm,
      },
      '../../lib/util/helpers.js': mockHelpers,
    })

    const client = new AccessContextManagerClient()
    const result = await client.listAccessPolicies({ parent: 'organizations/12345', pageSize: 10 }, 'mock-token')

    assert.strictEqual(mockList.mock.callCount(), 1)
    const callArgs = mockList.mock.calls[0].arguments[0]
    assert.strictEqual(callArgs.parent, 'organizations/12345')
    assert.strictEqual(callArgs.pageSize, 10)
    assert.deepStrictEqual(result, { accessPolicies: [] })
  })

  test('When listAccessPolicies is called without parent, then it throws an error', async () => {
    const { AccessContextManagerClient } = await esmock('../../lib/api/access_context_manager_client.js', {})
    const client = new AccessContextManagerClient()
    await assert.rejects(
      () => client.listAccessPolicies({}, 'mock-token'),
      /Missing required parameter: options.parent/,
    )
  })

  test('When createAccessLevel is called, then it calls the googleapi create method', async () => {
    const mockCreateLevel = mock.fn(async () => ({ data: { name: 'operations/level_create' } }))
    const mockAcm = {
      accessPolicies: {
        accessLevels: {
          create: mockCreateLevel,
        },
      },
    }

    const { AccessContextManagerClient } = await esmock('../../lib/api/access_context_manager_client.js', {
      '../../lib/util/api-client.js': {
        createApiClient: async () => mockAcm,
      },
      '../../lib/util/helpers.js': mockHelpers,
    })

    const client = new AccessContextManagerClient()
    const level = { name: 'accessPolicies/123/accessLevels/my_level', title: 'My Level' }
    const result = await client.createAccessLevel('accessPolicies/123', level, 'mock-token')

    assert.strictEqual(mockCreateLevel.mock.callCount(), 1)
    const callArgs = mockCreateLevel.mock.calls[0].arguments[0]
    assert.strictEqual(callArgs.parent, 'accessPolicies/123')
    assert.deepStrictEqual(callArgs.requestBody, level)
    assert.deepStrictEqual(result, { name: 'operations/level_create' })
  })

  test('When createAccessLevel is called without policyName, then it throws an error', async () => {
    const { AccessContextManagerClient } = await esmock('../../lib/api/access_context_manager_client.js', {})
    const client = new AccessContextManagerClient()
    await assert.rejects(
      () => client.createAccessLevel(null, {}, 'mock-token'),
      /Missing required parameter: policyName/,
    )
  })

  test('When listAccessLevels is called, then it calls the googleapi list method', async () => {
    const mockListLevels = mock.fn(async () => ({ data: { accessLevels: [] } }))
    const mockAcm = {
      accessPolicies: {
        accessLevels: {
          list: mockListLevels,
        },
      },
    }

    const { AccessContextManagerClient } = await esmock('../../lib/api/access_context_manager_client.js', {
      '../../lib/util/api-client.js': {
        createApiClient: async () => mockAcm,
      },
      '../../lib/util/helpers.js': mockHelpers,
    })

    const client = new AccessContextManagerClient()
    const result = await client.listAccessLevels(
      'accessPolicies/123',
      { pageSize: 5, accessLevelFormat: 'CEL' },
      'mock-token',
    )

    assert.strictEqual(mockListLevels.mock.callCount(), 1)
    const callArgs = mockListLevels.mock.calls[0].arguments[0]
    assert.strictEqual(callArgs.parent, 'accessPolicies/123')
    assert.strictEqual(callArgs.pageSize, 5)
    assert.strictEqual(callArgs.accessLevelFormat, 'CEL')
    assert.deepStrictEqual(result, { accessLevels: [] })
  })

  test('When listAccessLevels is called without policyName, then it throws an error', async () => {
    const { AccessContextManagerClient } = await esmock('../../lib/api/access_context_manager_client.js', {})
    const client = new AccessContextManagerClient()
    await assert.rejects(
      () => client.listAccessLevels(null, {}, 'mock-token'),
      /Missing required parameter: policyName/,
    )
  })
})
