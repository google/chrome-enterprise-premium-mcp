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

import { describe, it, mock, beforeEach } from 'node:test'
import assert from 'node:assert'
import { registerCheckAndEnableApiTool } from '../../tools/definitions/check_and_enable_api.js'
import { FakeServiceUsageClient } from '../../lib/api/fake_service_usage_client.js'
import { SERVICE_NAMES } from '../../lib/constants.js'

describe('check_and_enable_api tool', () => {
  let server

  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }
  })

  it('should report status of a disabled API by default', async () => {
    const serviceUsageClient = new FakeServiceUsageClient()
    const state = {}
    registerCheckAndEnableApiTool(server, { serviceUsageClient }, state)

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_api').arguments[2]

    const result = await handler({
      projectId: 'test-project',
      apiName: SERVICE_NAMES.ADMIN_SDK,
    }, { requestInfo: {} })

    assert.ok(result.content[0].text.includes(`API [${SERVICE_NAMES.ADMIN_SDK}] is currently DISABLED`))
    assert.ok(result.content[0].text.includes('Would you like to enable the missing API(s) listed above, or should I check for and enable ALL required APIs for your project?'))
  })

  it('should report status of only one API if checkAll is explicitly false', async () => {
    const serviceUsageClient = new FakeServiceUsageClient()
    const state = {}
    registerCheckAndEnableApiTool(server, { serviceUsageClient }, state)

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_api').arguments[2]

    const result = await handler({
      projectId: 'test-project',
      apiName: SERVICE_NAMES.ADMIN_SDK,
      checkAll: false,
    }, { requestInfo: {} })

    assert.ok(result.content[0].text.includes(`API [${SERVICE_NAMES.ADMIN_SDK}] is currently DISABLED`))
    // Should NOT include other APIs
    assert.ok(!result.content[0].text.includes(`API [${SERVICE_NAMES.CHROME_POLICY}]`))
  })

  it('should enable only one API if checkAll is false and apiName is provided', async () => {
    const serviceUsageClient = new FakeServiceUsageClient()
    const state = {}
    registerCheckAndEnableApiTool(server, { serviceUsageClient }, state)

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_api').arguments[2]

    const result = await handler({
      projectId: 'test-project',
      apiName: SERVICE_NAMES.ADMIN_SDK,
      enable: true,
      checkAll: false,
    }, { requestInfo: {} })

    // Only Admin SDK should be ENABLED
    assert.ok(result.content[0].text.includes(`API [${SERVICE_NAMES.ADMIN_SDK}] has been successfully ENABLED`))
    // Others should NOT be in the results
    assert.ok(!result.content[0].text.includes(`API [${SERVICE_NAMES.CHROME_POLICY}]`))
  })

  it('should enable only one API by default if apiName is provided', async () => {
    const serviceUsageClient = new FakeServiceUsageClient()
    const state = {}
    registerCheckAndEnableApiTool(server, { serviceUsageClient }, state)

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_api').arguments[2]

    const result = await handler({
      projectId: 'test-project',
      apiName: SERVICE_NAMES.ADMIN_SDK,
      enable: true,
    }, { requestInfo: {} })

    assert.ok(result.content[0].text.includes(`API [${SERVICE_NAMES.ADMIN_SDK}] has been successfully ENABLED`))
    // Should NOT include other APIs
    assert.ok(!result.content[0].text.includes(`API [${SERVICE_NAMES.CHROME_POLICY}]`))
  })

  it('should report status of an already enabled API', async () => {
    const serviceUsageClient = new FakeServiceUsageClient()
    // Manually enable it first
    await serviceUsageClient.enableService('test-project', SERVICE_NAMES.ADMIN_SDK, 'token')

    const state = {}
    registerCheckAndEnableApiTool(server, { serviceUsageClient }, state)

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_api').arguments[2]

    const result = await handler({
      projectId: 'test-project',
      apiName: SERVICE_NAMES.ADMIN_SDK,
    }, { requestInfo: {} })

    assert.ok(result.content[0].text.includes('is already ENABLED'))
  })

  it('should check all required APIs and report missing ones', async () => {
    const serviceUsageClient = new FakeServiceUsageClient()
    const state = {}
    registerCheckAndEnableApiTool(server, { serviceUsageClient }, state)

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_api').arguments[2]

    const result = await handler({
      projectId: 'test-project',
      checkAll: true,
    }, { requestInfo: {} })

    for (const api of Object.values(SERVICE_NAMES)) {
      assert.ok(result.content[0].text.includes(`API [${api}] is currently DISABLED`))
    }
    assert.ok(result.content[0].text.includes('Would you like to enable the missing APIs found during the check?'))
  })

  it('should enable all required APIs when checkAll and enable are true', async () => {
    const serviceUsageClient = new FakeServiceUsageClient()
    const state = {}
    registerCheckAndEnableApiTool(server, { serviceUsageClient }, state)

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_api').arguments[2]

    const result = await handler({
      projectId: 'test-project',
      checkAll: true,
      enable: true,
    }, { requestInfo: {} })

    for (const api of Object.values(SERVICE_NAMES)) {
      assert.ok(result.content[0].text.includes(`API [${api}] has been successfully ENABLED`))
    }
  })

  it('should handle cases where Service Usage API itself is disabled', async () => {
    const serviceUsageClient = {
      getServiceStatus: mock.fn(() => {
        throw new Error('API Error 403 (PERMISSION_DENIED): Service Usage API has not been used in project [test-project] before or it is disabled.')
      }),
    }
    const state = {}
    registerCheckAndEnableApiTool(server, { serviceUsageClient }, state)

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_api').arguments[2]

    const result = await handler({
      projectId: 'test-project',
      checkAll: true,
    }, { requestInfo: {} })

    assert.strictEqual(result.isError, true)
    assert.ok(result.content[0].text.includes('The Service Usage API is currently disabled'))
    assert.ok(result.content[0].text.includes('Once the API has been enabled, please notify me so that I can re-attempt the check and enablement of all other required services.'))
    assert.ok(result.content[0].text.includes('https://console.cloud.google.com/apis/library/serviceusage.googleapis.com'))
  })

  it('should report status of only the default API when only projectId is provided', async () => {
    const serviceUsageClient = new FakeServiceUsageClient()
    const state = {}
    registerCheckAndEnableApiTool(server, { serviceUsageClient }, state)

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_api').arguments[2]

    const result = await handler({
      projectId: 'test-project',
    }, { requestInfo: {} })

    assert.ok(result.content[0].text.includes(`API [${SERVICE_NAMES.ADMIN_SDK}] is currently DISABLED`))
    // Should NOT include other APIs
    assert.ok(!result.content[0].text.includes(`API [${SERVICE_NAMES.CHROME_POLICY}]`))
    assert.ok(result.content[0].text.includes('Would you like to enable the missing API(s) listed above, or should I check for and enable ALL required APIs for your project?'))
  })
})