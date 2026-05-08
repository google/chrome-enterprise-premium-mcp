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
import esmock from 'esmock'

describe('check_cep_subscription tool', () => {
  let server

  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }
  })

  test('When CEP subscription is found, then it returns success message', async () => {
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
        '../../lib/api/admin_sdk_client.js': { AdminSdkClient: MockAdminSdkClient },
        '../../lib/util/auth.js': {
          getAuthClient: async () => ({ source: 'adc' }),
        },
      },
    )

    registerTools(server, {
      apiClients: { adminSdk: new MockAdminSdkClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_cep_subscription')
      .arguments[2]

    const result = await handler({ customerId: 'C123' }, {})

    assert.strictEqual(mockCheckCepSubscription.mock.callCount(), 1)
    assert.match(result.content[0].text, /Chrome Enterprise Premium subscription is active/)
    assert.deepStrictEqual(result.structuredContent, {
      isActive: true,
      assignmentCount: 1,
      assignments: [{ productId: '101040', skuId: '1010400001' }],
    })
  })

  test('When CEP subscription is missing, then it returns information message', async () => {
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
        '../../lib/api/admin_sdk_client.js': { AdminSdkClient: MockAdminSdkClient },
        '../../lib/util/auth.js': {
          getAuthClient: async () => ({ source: 'adc' }),
        },
      },
    )

    registerTools(server, {
      apiClients: { adminSdk: new MockAdminSdkClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_cep_subscription')
      .arguments[2]

    const result = await handler({ customerId: 'C123' }, {})

    assert.strictEqual(mockCheckCepSubscription.mock.callCount(), 1)
    assert.match(result.content[0].text, /No Chrome Enterprise Premium license assignments found/)
    assert.deepStrictEqual(result.structuredContent, { isActive: false, assignmentCount: 0, assignments: [] })
  })

  test('When API call fails, then it returns error message', async () => {
    const mockCheckCepSubscription = mock.fn(async () => {
      throw new Error('API Error')
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
        '../../lib/api/admin_sdk_client.js': { AdminSdkClient: MockAdminSdkClient },
        '../../lib/util/auth.js': {
          getAuthClient: async () => ({ source: 'adc' }),
        },
      },
    )

    registerTools(server, {
      apiClients: { adminSdk: new MockAdminSdkClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_cep_subscription')
      .arguments[2]

    const result = await handler({ customerId: 'C123' }, {})

    assert.strictEqual(mockCheckCepSubscription.mock.callCount(), 1)
    assert.match(result.content[0].text, /Error: API Error/)
  })

  test('When access is denied, then it returns proactive auth remediation instructions', async () => {
    const mockCheckCepSubscription = mock.fn(async () => {
      const error = new Error('Permission denied')
      error.status = 403
      throw error
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
        '../../lib/api/admin_sdk_client.js': { AdminSdkClient: MockAdminSdkClient },
        '../../lib/util/auth.js': {
          getAuthClient: async () => ({ source: 'adc' }),
        },
      },
    )

    registerTools(server, {
      apiClients: { adminSdk: new MockAdminSdkClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_cep_subscription')
      .arguments[2]

    const result = await handler({ customerId: 'C123' }, {})

    assert.strictEqual(mockCheckCepSubscription.mock.callCount(), 1)
    assert.match(result.content[0].text, /Permission denied\. Your account lacks/)
    assert.match(result.content[0].text, /auth login/)
  })
})
