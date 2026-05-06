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
import { registerCheckAndEnableCepApiTool } from '../../tools/definitions/check_and_enable_cep_api.js'

describe('check_and_enable_cep_api Tool', () => {
  let server

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
  })

  test('When tool is registered, then it has the updated description with the "ask first" mandate', async () => {
    const serviceUsageClient = {}
    const state = {}
    registerCheckAndEnableCepApiTool(server, { serviceUsageClient }, state)

    const toolDefinition = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_cep_api')
      .arguments[1]

    assert.ok(
      toolDefinition.description.includes(
        'Verify or enable Google Cloud APIs required for Chrome Enterprise Premium features.',
      ),
    )
    assert.ok(
      toolDefinition.description.includes(
        'Always ask the user before enabling APIs unless they have explicitly authorized it in this turn.',
      ),
    )
  })

  test('When authentication errors occur, then it returns remediation instructions', async () => {
    const mockListEnabledServices = mock.fn(async () => {
      const err = new Error('UNAUTHENTICATED')
      err.status = 401
      throw err
    })

    const serviceUsageClient = {
      listEnabledServices: mockListEnabledServices,
    }

    const state = { customerId: null }
    registerCheckAndEnableCepApiTool(server, { serviceUsageClient }, state)

    const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'check_and_enable_cep_api')
      .arguments[2]

    const result = await handler(
      {
        projectId: 'project1',
        checkAll: false,
      },
      { requestInfo: {} },
    )

    assert.strictEqual(result.isError, true)
    assert.ok(result.content[0].text.includes('Authentication required'))
  })
})
