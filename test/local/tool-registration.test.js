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
import { registerTools } from '../../tools/tools.js'

// Tests for CEP tool registration and individual tool handler logic.
describe('CEP Tool Registration', () => {
  let server

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
  })

  // Test if all tools are registered with the server.
  it('should register all expected tools', () => {
    registerTools(server)

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    const expectedToolNames = [
      'count_browser_versions',
      'list_customer_profiles',
      'list_dlp_rules',
      'create_dlp_rule',
      'get_chrome_activity_log',
      'analyze_chrome_logs_for_risky_activity',
      'delete_dlp_rule',
      'create_url_list',
      'get_connector_policy',
      'get_customer_id',
      'list_org_units',
    ].sort()
    assert.deepStrictEqual(
      registeredToolNames.sort(),
      expectedToolNames,
      'The list of registered tool names does not match the expected list.',
    )
  })
})
