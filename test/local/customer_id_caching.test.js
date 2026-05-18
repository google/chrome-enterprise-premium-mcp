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
import { guardedToolCall } from '../../tools/utils/wrapper.js'

describe('Customer ID Caching and Auto-Resolution', () => {
  beforeEach(() => {})

  test('When a tool is called without a customer ID, then it fetches and caches the customer ID for subsequent calls', async () => {
    const mockGetCustomerId = mock.fn(async () => ({ id: 'C_AUTO_RESOLVED' }))
    const mockListOrgUnits = mock.fn(async () => [])
    const MockAdminSdkClient = class {
      constructor() {
        this.getCustomerId = mockGetCustomerId
        this.listOrgUnits = mockListOrgUnits
      }
    }
    const adminSdkClientInstance = new MockAdminSdkClient()

    const sessionState = { customerId: null }
    const listOrgUnitsHandler = guardedToolCall(
      {
        handler: async params => {
          return adminSdkClientInstance.listOrgUnits(params)
        },
      },
      { apiClients: { adminSdk: adminSdkClientInstance } },
      sessionState,
    )

    // First call
    await listOrgUnitsHandler({}, { requestInfo: { headers: { authorization: 'Bearer fake' } } })
    assert.strictEqual(mockGetCustomerId.mock.callCount(), 1, 'getCustomerId should be called once')
    const firstCallArgs = mockListOrgUnits.mock.calls[0].arguments
    assert.strictEqual(firstCallArgs[0].customerId, 'C_AUTO_RESOLVED', 'First call should use resolved ID')

    // Second call
    await listOrgUnitsHandler({}, { requestInfo: { headers: { authorization: 'Bearer fake' } } })
    assert.strictEqual(mockGetCustomerId.mock.callCount(), 1, 'getCustomerId should NOT be called again')
    const secondCallArgs = mockListOrgUnits.mock.calls[1].arguments
    assert.strictEqual(secondCallArgs[0].customerId, 'C_AUTO_RESOLVED', 'Second call should use cached ID')
  })

  test('When a tool is called with an explicit customer ID, then it respects it and updates the cache without resolving', async () => {
    const mockGetCustomerId = mock.fn(async () => ({ id: 'C_DEFAULT' }))
    const mockListOrgUnits = mock.fn(async () => [])
    const MockAdminSdkClient = class {
      constructor() {
        this.getCustomerId = mockGetCustomerId
        this.listOrgUnits = mockListOrgUnits
      }
    }
    const adminSdkClientInstance = new MockAdminSdkClient()

    const sessionState = { customerId: null }
    const listOrgUnitsHandler = guardedToolCall(
      {
        handler: async params => {
          return adminSdkClientInstance.listOrgUnits(params)
        },
      },
      { apiClients: { adminSdk: adminSdkClientInstance } },
      sessionState,
    )

    // Call with explicit ID
    await listOrgUnitsHandler(
      { customerId: 'C_EXPLICIT' },
      { requestInfo: { headers: { authorization: 'Bearer fake' } } },
    )
    assert.strictEqual(mockGetCustomerId.mock.callCount(), 0)
    assert.strictEqual(mockListOrgUnits.mock.calls[0].arguments[0].customerId, 'C_EXPLICIT')
    assert.strictEqual(sessionState.customerId, 'C_EXPLICIT')
  })

  test('When getCustomerId throws during auto-resolve, then the tool returns isError true without running with undefined customerId', async () => {
    const authError = new Error('UNAUTHENTICATED: credentials are invalid')
    authError.status = 401
    const mockGetCustomerId = mock.fn(async () => {
      throw authError
    })
    const mockHandler = mock.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    const adminSdkClientInstance = { getCustomerId: mockGetCustomerId }

    const sessionState = { customerId: null }
    const tool = guardedToolCall(
      { handler: mockHandler },
      { apiClients: { adminSdk: adminSdkClientInstance } },
      sessionState,
    )

    const result = await tool({}, { requestInfo: { headers: { authorization: 'Bearer fake' } } })

    assert.strictEqual(result.isError, true, 'Tool should return isError: true when auto-resolve fails')
    assert.strictEqual(
      mockHandler.mock.callCount(),
      0,
      'Underlying handler should not be called when auto-resolve fails',
    )
    assert.ok(result.content[0].text.length > 0, 'Error response should contain a message')
  })
})
