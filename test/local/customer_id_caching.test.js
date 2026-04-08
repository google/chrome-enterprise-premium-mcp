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
import { describe, it, mock, beforeEach } from 'node:test'
import { guardedToolCall } from '../../tools/utils.js'

describe('Customer ID Caching and Auto-Resolution', () => {
  let server

  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }
  })

  it('should fetch customerId on first tool call and cache it for subsequent calls', async () => {
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
        handler: async (params, context) => {
          return adminSdkClientInstance.listOrgUnits(params)
        },
      },
      { apiClients: { adminSdk: adminSdkClientInstance } },
      sessionState,
    )

    // First call
    await listOrgUnitsHandler({}, { requestInfo: {} })
    assert.strictEqual(mockGetCustomerId.mock.callCount(), 1, 'getCustomerId should be called once')
    const firstCallArgs = mockListOrgUnits.mock.calls[0].arguments
    assert.strictEqual(firstCallArgs[0].customerId, 'C_AUTO_RESOLVED', 'First call should use resolved ID')

    // Second call
    await listOrgUnitsHandler({}, { requestInfo: {} })
    assert.strictEqual(mockGetCustomerId.mock.callCount(), 1, 'getCustomerId should NOT be called again')
    const secondCallArgs = mockListOrgUnits.mock.calls[1].arguments
    assert.strictEqual(secondCallArgs[0].customerId, 'C_AUTO_RESOLVED', 'Second call should use cached ID')
  })

  it('should respect explicitly provided customerId and not overwrite cache if different', async () => {
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
        handler: async (params, context) => {
          return adminSdkClientInstance.listOrgUnits(params)
        },
      },
      { apiClients: { adminSdk: adminSdkClientInstance } },
      sessionState,
    )

    // Call with explicit ID
    await listOrgUnitsHandler({ customerId: 'C_EXPLICIT' }, { requestInfo: {} })
    assert.strictEqual(mockGetCustomerId.mock.callCount(), 0)
    assert.strictEqual(mockListOrgUnits.mock.calls[0].arguments[0].customerId, 'C_EXPLICIT')
    assert.strictEqual(sessionState.customerId, 'C_EXPLICIT')
  })
})
