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
import { registerCheckAndEnableCepApiTool } from '../../tools/definitions/check_and_enable_cep_api.js'

describe('check_and_enable_cep_api tool description', () => {
  let server

  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }
  })

  it('should have the updated description with the "ask first" mandate', async () => {
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
})
