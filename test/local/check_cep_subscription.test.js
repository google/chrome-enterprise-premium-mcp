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
import esmock from 'esmock'
import { RealAdminSdkClient } from '../../lib/api/real_admin_sdk_client.js'

describe('check_cep_subscription Tool', () => {
  let server

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
  })

  it('should return success message when CEP subscription is found', async () => {
    const mockCheckCepSubscription = mock.fn(async () => ({
      items: [{ productId: '101040', skuId: '1010400001' }],
    }))

    const MockAdminSdkClient = class {
      constructor() {
        this.checkCepSubscription = mockCheckCepSubscription
      }
    }

    const { registerTools } = await esmock(
      '../../tools/index.js',
      {},
      {
        '../../lib/api/real_admin_sdk_client.js': {
          RealAdminSdkClient: MockAdminSdkClient,
        },
      },
    )

    registerTools(server, {
      apiClients: { adminSdk: new MockAdminSdkClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_cep_subscription')
      .arguments[2]

    const result = await handler({ customerId: 'C0123' }, {})

    assert.strictEqual(mockCheckCepSubscription.mock.callCount(), 1)
    assert.match(
      result.content[0].text,
      /Chrome Enterprise Premium subscription is active\. 1 license assignment\(s\) found\./,
    )
  })

  it('should return info message when no CEP subscription is found', async () => {
    const mockCheckCepSubscription = mock.fn(async () => ({
      items: [],
    }))

    const MockAdminSdkClient = class {
      constructor() {
        this.checkCepSubscription = mockCheckCepSubscription
      }
    }

    const { registerTools } = await esmock(
      '../../tools/index.js',
      {},
      {
        '../../lib/api/real_admin_sdk_client.js': {
          RealAdminSdkClient: MockAdminSdkClient,
        },
      },
    )

    registerTools(server, {
      apiClients: { adminSdk: new MockAdminSdkClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_cep_subscription')
      .arguments[2]

    const result = await handler({ customerId: 'C0123' }, {})

    assert.strictEqual(mockCheckCepSubscription.mock.callCount(), 1)
    assert.match(
      result.content[0].text,
      /Chrome Enterprise Premium license assignments found\. The customer may have a subscription but no licenses assigned yet\./,
    )
    assert.strictEqual(result.structuredContent.isActive, false)
    assert.strictEqual(result.structuredContent.assignmentCount, 0)
  })

  it('should return error message when Licensing API is not enabled', async () => {
    const mockCheckCepSubscription = mock.fn(async () => {
      throw new Error(
        'API [licensing.googleapis.com] is not enabled. Please enable it at https://console.cloud.google.com/apis/library/licensing.googleapis.com',
      )
    })

    const MockAdminSdkClient = class {
      constructor() {
        this.checkCepSubscription = mockCheckCepSubscription
      }
    }

    const { registerTools } = await esmock(
      '../../tools/index.js',
      {},
      {
        '../../lib/api/real_admin_sdk_client.js': {
          RealAdminSdkClient: MockAdminSdkClient,
        },
      },
    )

    registerTools(server, {
      apiClients: { adminSdk: new MockAdminSdkClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_cep_subscription')
      .arguments[2]

    const result = await handler({ customerId: 'C0123' }, {})

    assert.strictEqual(mockCheckCepSubscription.mock.callCount(), 1)
    assert.match(result.content[0].text, /Error: API \[licensing.googleapis.com\] is not enabled/)
    assert.match(result.content[0].text, /https:\/\/console.cloud.google.com\/apis\/library\/licensing.googleapis.com/)
  })

  it('should return error message when access is denied', async () => {
    const mockCheckCepSubscription = mock.fn(async () => {
      throw new Error(
        'Access denied to Licensing API. The account may not have permission to access licensing information.',
      )
    })

    const MockAdminSdkClient = class {
      constructor() {
        this.checkCepSubscription = mockCheckCepSubscription
      }
    }

    const { registerTools } = await esmock(
      '../../tools/index.js',
      {},
      {
        '../../lib/api/real_admin_sdk_client.js': {
          RealAdminSdkClient: MockAdminSdkClient,
        },
      },
    )

    registerTools(server, {
      apiClients: { adminSdk: new MockAdminSdkClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_cep_subscription')
      .arguments[2]

    const result = await handler({ customerId: 'C0123' }, {})

    assert.strictEqual(mockCheckCepSubscription.mock.callCount(), 1)
    assert.match(result.content[0].text, /Error: Access denied to Licensing API/)
  })
})

describe('RealAdminSdkClient', () => {
  describe('checkCepSubscription', () => {
    it('should resolve CURRENT_CUSTOMER to actual customer ID before querying Licensing API', async () => {
      const client = new RealAdminSdkClient()

      const mockListForProductAndSku = mock.fn(async () => {
        return { data: { items: [] } }
      })

      client.getLicensingService = mock.fn(async () => {
        return {
          licenseAssignments: {
            listForProductAndSku: mockListForProductAndSku,
          },
        }
      })

      client.getCustomerId = mock.fn(async () => {
        return { id: 'C_REAL_ID' }
      })

      // We need to bypass the actual callWithRetry logic for the test if it's tricky,
      // but callWithRetry in lib/util/helpers.js just executes the function.

      await client.checkCepSubscription('my_customer', 'fake_token')

      assert.strictEqual(client.getCustomerId.mock.callCount(), 1)
      assert.strictEqual(mockListForProductAndSku.mock.callCount(), 1)

      const args = mockListForProductAndSku.mock.calls[0].arguments[0]
      assert.strictEqual(args.customerId, 'C_REAL_ID')
    })

    it('should use provided customer ID directly without resolving if it is not my_customer', async () => {
      const client = new RealAdminSdkClient()

      const mockListForProductAndSku = mock.fn(async () => {
        return { data: { items: [] } }
      })

      client.getLicensingService = mock.fn(async () => {
        return {
          licenseAssignments: {
            listForProductAndSku: mockListForProductAndSku,
          },
        }
      })

      client.getCustomerId = mock.fn(async () => {
        return { id: 'C_REAL_ID' }
      })

      await client.checkCepSubscription('C012345', 'fake_token')

      assert.strictEqual(client.getCustomerId.mock.callCount(), 0)
      assert.strictEqual(mockListForProductAndSku.mock.callCount(), 1)

      const args = mockListForProductAndSku.mock.calls[0].arguments[0]
      assert.strictEqual(args.customerId, 'C012345')
    })
  })
})
