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

describe('Admin SDK API', () => {
  let server

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
  })

  describe('get_customer_id Tool', () => {
    it('should call getCustomerId and return formatted result', async () => {
      const mockGetCustomerId = mock.fn(async () => ({ id: 'C0123' }))
      const MockAdminSdkClient = class {
        constructor() {
          this.getCustomerId = mockGetCustomerId
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

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_customer_id').arguments[2]

      const result = await handler(
        {},
        {}, // Added mock context
      )

      assert.strictEqual(mockGetCustomerId.mock.callCount(), 1)
      assert.ok(result.content[0].text.includes('Customer ID: `C0123`'))
      assert.ok(result.content[1].text.includes('```json'))
      assert.ok(result.content[1].text.includes('"id": "C0123"'))
    })

    it('should return an error message if API call fails', async () => {
      const mockGetCustomerId = mock.fn(async () => {
        throw new Error('API Error')
      })
      const MockAdminSdkClient = class {
        constructor() {
          this.getCustomerId = mockGetCustomerId
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

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_customer_id').arguments[2]

      const result = await handler(
        {},
        {}, // Added mock context
      )
      assert.deepStrictEqual(result.content[0].text, 'Error: API Error')
    })
  })

  describe('list_org_units Tool', () => {
    it('should call listOrgUnits and return formatted result', async () => {
      const mockListOrgUnits = mock.fn(async () => ({
        organizationUnits: [
          { name: 'ou1', orgUnitId: 'ou1' },
          { name: 'ou2', orgUnitId: 'ou2' },
        ],
      }))
      const MockAdminSdkClient = class {
        constructor() {
          this.listOrgUnits = mockListOrgUnits
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

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_org_units').arguments[2]

      const result = await handler(
        {},
        {}, // Added mock context
      )

      assert.strictEqual(mockListOrgUnits.mock.callCount(), 1)
      assert.ok(result.content[0].text.includes('## Organizational Units (2)'))
      assert.ok(result.content[0].text.includes('- **ou1**'))
      assert.ok(result.content[0].text.includes('ID: `ou1`'))
      assert.ok(result.content[1].text.includes('```json'))
    })

    it('should return an error message if API call fails', async () => {
      const mockListOrgUnits = mock.fn(async () => {
        throw new Error('API Error')
      })
      const MockAdminSdkClient = class {
        constructor() {
          this.listOrgUnits = mockListOrgUnits
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

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_org_units').arguments[2]

      const result = await handler({}, {})
      assert.deepStrictEqual(result.content[0].text, 'Error: API Error')
    })
  })

  describe('check_user_cep_license Tool', () => {
    it('should call checkUserCepLicense and return success if license found', async () => {
      const userId = 'user@example.com'
      const mockCheckUserCepLicense = mock.fn(async () => ({ productId: '101040', skuId: '1010400001' }))
      const MockAdminSdkClient = class {
        constructor() {
          this.checkUserCepLicense = mockCheckUserCepLicense
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

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_user_cep_license')
        .arguments[2]

      const result = await handler({ userId }, {})

      assert.strictEqual(mockCheckUserCepLicense.mock.callCount(), 1)
      assert.strictEqual(mockCheckUserCepLicense.mock.calls[0].arguments[0], userId)
      assert.ok(result.content[0].text.includes('User user@example.com has a Chrome Enterprise Premium license.'))
      assert.ok(result.content[1].text.includes('```json'))
      assert.deepStrictEqual(result.structuredContent, {
        hasLicense: true,
        license: { productId: '101040', skuId: '1010400001' },
      })
    })

    it('should call checkUserCepLicense and return info if license not found', async () => {
      const userId = 'user@example.com'
      const mockCheckUserCepLicense = mock.fn(async () => null)
      const MockAdminSdkClient = class {
        constructor() {
          this.checkUserCepLicense = mockCheckUserCepLicense
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

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_user_cep_license')
        .arguments[2]

      const result = await handler({ userId }, {})

      assert.strictEqual(mockCheckUserCepLicense.mock.callCount(), 1)
      assert.ok(
        result.content[0].text.includes('User user@example.com does not have a Chrome Enterprise Premium license.'),
      )
      assert.deepStrictEqual(result.structuredContent, {
        hasLicense: false,
        license: null,
      })
    })

    it('should return an error message if API call fails', async () => {
      const mockCheckUserCepLicense = mock.fn(async () => {
        throw new Error('API Error')
      })
      const MockAdminSdkClient = class {
        constructor() {
          this.checkUserCepLicense = mockCheckUserCepLicense
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

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_user_cep_license')
        .arguments[2]

      const result = await handler({ userId: 'user@example.com' }, {})
      // Verify both human-readable text and structured error content are returned
      assert.deepStrictEqual(result.content[0].text, 'Error: API Error')
      assert.deepStrictEqual(result.structuredContent, { error: true, message: 'API Error' })
    })

    it('should return error message when Licensing API is not enabled', async () => {
      const mockCheckUserCepLicense = mock.fn(async () => {
        throw new Error(
          'API [licensing.googleapis.com] is not enabled. Please enable it at https://console.cloud.google.com/apis/library/licensing.googleapis.com',
        )
      })

      const MockAdminSdkClient = class {
        constructor() {
          this.checkUserCepLicense = mockCheckUserCepLicense
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

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_user_cep_license')
        .arguments[2]

      const result = await handler({ userId: 'user@example.com' }, {})

      assert.strictEqual(mockCheckUserCepLicense.mock.callCount(), 1)
      assert.match(result.content[0].text, /Error: API \[licensing.googleapis.com\] is not enabled/)
      assert.match(
        result.content[0].text,
        /https:\/\/console.cloud.google.com\/apis\/library\/licensing.googleapis.com/,
      )
    })

    it('should return error message when access is denied', async () => {
      const mockCheckUserCepLicense = mock.fn(async () => {
        throw new Error(
          'Access denied to Licensing API. The account may not have permission to access licensing information.',
        )
      })

      const MockAdminSdkClient = class {
        constructor() {
          this.checkUserCepLicense = mockCheckUserCepLicense
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

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_user_cep_license')
        .arguments[2]

      const result = await handler({ userId: 'user@example.com' }, {})

      assert.strictEqual(mockCheckUserCepLicense.mock.callCount(), 1)
      assert.match(result.content[0].text, /Error: Access denied to Licensing API/)
    })
  })
})
