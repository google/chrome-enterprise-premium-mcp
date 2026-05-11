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

import { describe, test, mock, beforeEach } from 'node:test'
import assert from 'node:assert'
import { esmock } from '../helpers/mock-utils.js'
import { SERVICE_NAMES } from '../../lib/constants.js'

describe('check_and_enable_cep_api tool', () => {
  let server

  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }
  })

  async function setupTool(mockServiceUsageClient) {
    const { registerCheckAndEnableCepApiTool } = await esmock(
      '../../tools/definitions/check_and_enable_cep_api.js',
      {},
      {
        '../../lib/api/service_usage_client.js': {
          ServiceUsageClient: class {
            constructor() {
              Object.assign(this, mockServiceUsageClient)
            }
          },
        },
      },
    )
    registerCheckAndEnableCepApiTool(server, { serviceUsageClient: mockServiceUsageClient }, {})
    return server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_cep_api').arguments[2]
  }

  test('When an API is disabled, then it reports its status and offers remediation', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        apiName: SERVICE_NAMES.ADMIN_SDK,
      },
      { requestInfo: {} },
    )

    assert.ok(result.content[0].text.includes(`- **${SERVICE_NAMES.ADMIN_SDK}** — DISABLED`))
    assert.ok(
      result.content[0].text.includes(
        "Would you like to enable the missing APIs found during the check? Call this tool again with 'enable: true'.",
      ),
    )
  })

  test('When checkAll is false, then it reports status of only one specific API', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        apiName: SERVICE_NAMES.ADMIN_SDK,
        checkAll: false,
      },
      { requestInfo: {} },
    )

    assert.ok(result.content[0].text.includes(`- **${SERVICE_NAMES.ADMIN_SDK}** — DISABLED`))
    // Should NOT include other APIs
    assert.ok(!result.content[0].text.includes(`API:** \`${SERVICE_NAMES.CHROME_POLICY}\``))
  })

  test('When enable is true and checkAll is false, then it enables only one specific API', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
      enableService: mock.fn(async () => ({ done: true })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        apiName: SERVICE_NAMES.ADMIN_SDK,
        enable: true,
        checkAll: false,
      },
      { requestInfo: {} },
    )

    // Only Admin SDK should be ENABLED
    assert.ok(result.content[0].text.includes(`- **${SERVICE_NAMES.ADMIN_SDK}** — NEWLY_ENABLED`))
    // Others should NOT be in the results
    assert.ok(!result.content[0].text.includes(`API:** \`${SERVICE_NAMES.CHROME_POLICY}\``))
  })

  test('When apiName is provided and enable is true, then it enables the specific API', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
      enableService: mock.fn(async () => ({ done: true })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        apiName: SERVICE_NAMES.ADMIN_SDK,
        enable: true,
      },
      { requestInfo: {} },
    )

    assert.ok(result.content[0].text.includes(`- **${SERVICE_NAMES.ADMIN_SDK}** — NEWLY_ENABLED`))
  })

  test('When an API is already enabled, then it reports its status as ENABLED', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'ENABLED',
      })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        apiName: SERVICE_NAMES.ADMIN_SDK,
      },
      { requestInfo: {} },
    )

    assert.ok(result.content[0].text.includes('— ENABLED'))
  })

  test('When checkAll is true, then it checks and reports status of all required APIs', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        checkAll: true,
      },
      { requestInfo: {} },
    )

    for (const api of Object.values(SERVICE_NAMES)) {
      assert.ok(result.content[0].text.includes(`- **${api}** — DISABLED`))
    }
    assert.ok(result.content[0].text.includes('Would you like to enable the missing APIs found during the check?'))
  })

  test('When checkAll and enable are true, then it enables all required APIs', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
      enableService: mock.fn(async () => ({ done: true })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        checkAll: true,
        enable: true,
      },
      { requestInfo: {} },
    )

    for (const api of Object.values(SERVICE_NAMES)) {
      assert.ok(result.content[0].text.includes(`- **${api}** — NEWLY_ENABLED`))
    }
  })

  test('When Service Usage API itself is disabled, then it returns a dedicated remediation message', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(() => {
        throw new Error(
          'API Error 403 (PERMISSION_DENIED): Service Usage API has not been used in project [test-project] before or it is disabled.',
        )
      }),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        checkAll: true,
      },
      { requestInfo: {} },
    )

    assert.strictEqual(result.structuredContent.error, true)
    assert.ok(result.content[0].text.includes('Service Usage API is disabled'))
    assert.ok(
      result.content[0].text.includes(
        'Once the API has been enabled, please notify me so that I can re-attempt the check and enablement of all other required services.',
      ),
    )
    assert.ok(
      result.content[0].text.includes('https://console.cloud.google.com/apis/library/serviceusage.googleapis.com'),
    )
  })

  test('When checkAll is false and only projectId is provided, then it reports status of only the default API', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        checkAll: false,
      },
      { requestInfo: {} },
    )

    assert.ok(result.content[0].text.includes(`- **${SERVICE_NAMES.ADMIN_SDK}** — DISABLED`))
    // Should NOT include other APIs
    assert.ok(!result.content[0].text.includes(`**${SERVICE_NAMES.CHROME_POLICY}**`))
    assert.ok(
      result.content[0].text.includes(
        'Would you like to enable the missing API(s) listed above, or should I check for and enable ALL required APIs for your project?',
      ),
    )
  })

  test('When enableService returns done:true, then the API is marked ENABLED (synchronous LRO)', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
      enableService: mock.fn(async () => ({ done: true, response: { state: 'ENABLED' } })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        apiName: SERVICE_NAMES.ADMIN_SDK,
        enable: true,
        checkAll: false,
      },
      { requestInfo: {} },
    )

    assert.ok(result.content[0].text.includes(`- **${SERVICE_NAMES.ADMIN_SDK}** — NEWLY_ENABLED`))
    const status = result.structuredContent.apiStatuses.find(s => s.apiName === SERVICE_NAMES.ADMIN_SDK)
    assert.strictEqual(status.status, 'ENABLED')
  })

  test('When enableService returns done:false, then the API is marked ENABLING with a pending message', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
      enableService: mock.fn(async () => ({
        done: false,
        name: 'operations/test-operation-123',
      })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        apiName: SERVICE_NAMES.ADMIN_SDK,
        enable: true,
        checkAll: false,
      },
      { requestInfo: {} },
    )

    assert.ok(result.content[0].text.includes(`- **${SERVICE_NAMES.ADMIN_SDK}** — ENABLING`))
    assert.ok(result.content[0].text.includes('enable requested, may take a few minutes'))
    assert.ok(result.content[0].text.includes('Re-run this tool to verify status.'))
    assert.ok(
      !result.content[0].text.includes('operations/test-operation-123'),
      'opaque operation ID should not appear in the user-facing summary',
    )
    const status = result.structuredContent.apiStatuses.find(s => s.apiName === SERVICE_NAMES.ADMIN_SDK)
    assert.strictEqual(status.status, 'ENABLING')
    assert.strictEqual(status.operationName, 'operations/test-operation-123')
  })

  test('When enableService returns done:false with no operation name, then operationName is omitted from structuredContent', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
      enableService: mock.fn(async () => ({ done: false })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      {
        projectId: 'test-project',
        apiName: SERVICE_NAMES.ADMIN_SDK,
        enable: true,
        checkAll: false,
      },
      { requestInfo: {} },
    )

    assert.ok(result.content[0].text.includes(`- **${SERVICE_NAMES.ADMIN_SDK}** — ENABLING`))
    assert.ok(
      !result.content[0].text.includes('unknown'),
      'no "unknown" literal when upstream returned no operation name',
    )
    const status = result.structuredContent.apiStatuses.find(s => s.apiName === SERVICE_NAMES.ADMIN_SDK)
    assert.strictEqual(status.status, 'ENABLING')
    assert.strictEqual(status.operationName, undefined)
  })

  test('When enableService returns an LRO error, then the API is marked FAILED with the message', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
      enableService: mock.fn(async () => ({
        done: true,
        error: { code: 7, message: 'Billing must be enabled for this project to use Service Usage.' },
      })),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      { projectId: 'test-project', apiName: SERVICE_NAMES.ADMIN_SDK, enable: true, checkAll: false },
      { requestInfo: {} },
    )

    assert.ok(result.content[0].text.includes(`- **${SERVICE_NAMES.ADMIN_SDK}** — FAILED`))
    assert.ok(result.content[0].text.includes('Billing must be enabled'))
    assert.ok(
      !result.content[0].text.includes('NEWLY_ENABLED'),
      'an LRO with done:true plus error must not be reported as NEWLY_ENABLED',
    )
    const status = result.structuredContent.apiStatuses.find(s => s.apiName === SERVICE_NAMES.ADMIN_SDK)
    assert.strictEqual(status.status, 'FAILED')
    assert.ok(status.error.includes('Billing must be enabled'))
  })

  test('When enableService returns an unexpected response shape, then the API is marked UNKNOWN', async () => {
    const mockServiceUsageClient = {
      getServiceStatus: mock.fn(async (projectId, api) => ({
        name: `projects/${projectId}/services/${api}`,
        state: 'DISABLED',
      })),
      enableService: mock.fn(async () => ({})),
    }

    const handler = await setupTool(mockServiceUsageClient)

    const result = await handler(
      { projectId: 'test-project', apiName: SERVICE_NAMES.ADMIN_SDK, enable: true, checkAll: false },
      { requestInfo: {} },
    )

    assert.ok(result.content[0].text.includes(`- **${SERVICE_NAMES.ADMIN_SDK}** — UNKNOWN`))
    assert.ok(
      !result.content[0].text.includes('ENABLING'),
      'an unexpected response shape must not be misreported as ENABLING',
    )
    const status = result.structuredContent.apiStatuses.find(s => s.apiName === SERVICE_NAMES.ADMIN_SDK)
    assert.strictEqual(status.status, 'UNKNOWN')
  })
})
