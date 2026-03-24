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

const SEB_EXTENSION_ID = 'ekajlcmdfcigmdbphhifahdfjbkciflj'
const INSTALL_TYPE_SCHEMA = 'chrome.users.apps.InstallType'

describe('Extension Tools', () => {
  let server

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
  })

  it('check_seb_extension_status should return success if extension is installed', async () => {
    const mockResolvePolicy = mock.fn(async () => [
      {
        targetKey: {
          additionalTargetKeys: { app_id: `chrome:${SEB_EXTENSION_ID}` },
        },
        value: {
          policySchema: INSTALL_TYPE_SCHEMA,
          value: {
            appInstallType: 'FORCED',
          },
        },
      },
    ])

    const MockChromePolicyClient = class {
      constructor() {
        this.resolvePolicy = mockResolvePolicy
      }
    }

    const { registerTools } = await esmock(
      '../../tools/tools.js',
      {},
      {
        '../../lib/api/real_chrome_policy_client.js': {
          RealChromePolicyClient: MockChromePolicyClient,
        },
      },
    )

    registerTools(server, {
      apiClients: { chromePolicy: new MockChromePolicyClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_seb_extension_status')
      .arguments[2]

    const result = await handler({ customerId: 'C123', orgUnitId: 'ou1' }, { requestInfo: {} })

    assert.strictEqual(mockResolvePolicy.mock.callCount(), 1)
    assert.ok(result.content[0].text.includes('✅'))
  })

  it('check_seb_extension_status should return error indicator if extension is missing', async () => {
    const mockResolvePolicy = mock.fn(async () => [])

    const MockChromePolicyClient = class {
      constructor() {
        this.resolvePolicy = mockResolvePolicy
      }
    }

    const { registerTools } = await esmock(
      '../../tools/tools.js',
      {},
      {
        '../../lib/api/real_chrome_policy_client.js': {
          RealChromePolicyClient: MockChromePolicyClient,
        },
      },
    )

    registerTools(server, {
      apiClients: { chromePolicy: new MockChromePolicyClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_seb_extension_status')
      .arguments[2]

    const result = await handler({ customerId: 'C123', orgUnitId: 'ou1' }, { requestInfo: {} })

    assert.ok(result.content[0].text.includes('❌'))
  })

  it('install_seb_extension should skip if already installed', async () => {
    const mockResolvePolicy = mock.fn(async () => [
      {
        targetKey: {
          additionalTargetKeys: { app_id: `chrome:${SEB_EXTENSION_ID}` },
        },
        value: {
          policySchema: INSTALL_TYPE_SCHEMA,
          value: { appInstallType: 'FORCED' },
        },
      },
    ])
    const mockBatchModifyPolicy = mock.fn()

    const MockChromePolicyClient = class {
      constructor() {
        this.resolvePolicy = mockResolvePolicy
        this.batchModifyPolicy = mockBatchModifyPolicy
      }
    }

    const { registerTools } = await esmock(
      '../../tools/tools.js',
      {},
      {
        '../../lib/api/real_chrome_policy_client.js': {
          RealChromePolicyClient: MockChromePolicyClient,
        },
      },
    )

    registerTools(server, {
      apiClients: { chromePolicy: new MockChromePolicyClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'install_seb_extension')
      .arguments[2]

    const result = await handler({ customerId: 'C123', orgUnitId: 'ou1' }, { requestInfo: {} })

    assert.strictEqual(mockBatchModifyPolicy.mock.callCount(), 0)
    assert.ok(result.content[0].text.includes('already force-installed'))
  })

  it('install_seb_extension should install if missing', async () => {
    const mockResolvePolicy = mock.fn(async () => [])
    const mockBatchModifyPolicy = mock.fn()

    const MockChromePolicyClient = class {
      constructor() {
        this.resolvePolicy = mockResolvePolicy
        this.batchModifyPolicy = mockBatchModifyPolicy
      }
    }

    const { registerTools } = await esmock(
      '../../tools/tools.js',
      {},
      {
        '../../lib/api/real_chrome_policy_client.js': {
          RealChromePolicyClient: MockChromePolicyClient,
        },
      },
    )

    registerTools(server, {
      apiClients: { chromePolicy: new MockChromePolicyClient() },
    })

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'install_seb_extension')
      .arguments[2]

    const result = await handler({ customerId: 'C123', orgUnitId: 'ou1' }, { requestInfo: {} })

    assert.strictEqual(mockBatchModifyPolicy.mock.callCount(), 1)
    const passedRequests = mockBatchModifyPolicy.mock.calls[0].arguments[2]
    assert.strictEqual(passedRequests[0].policyValue.value.appInstallType, 'FORCED')
    assert.strictEqual(passedRequests[0].policyTargetKey.additionalTargetKeys.app_id, `chrome:${SEB_EXTENSION_ID}`)
    assert.ok(result.content[0].text.includes('Successfully force-installed'))
  })
})
