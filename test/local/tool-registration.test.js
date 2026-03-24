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

/**
 * @fileoverview Tests for MCP tool registration.
 */

import assert from 'node:assert/strict'
import { describe, it, mock, beforeEach } from 'node:test'
import { registerTools } from '../../tools/tools.js'

// Tests for SEB tool registration and individual tool handler logic.
describe('SEB Tool Registration', () => {
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
      'check_cep_subscription',
      'check_user_cep_license',
      'count_browser_versions',
      'list_customer_profiles',
      'list_dlp_rules',
      'create_chrome_dlp_rule',
      'delete_dlp_rule',
      'list_detectors',
      'create_regex_detector',
      'create_url_list_detector',
      'create_word_list_detector',
      'delete_detector',
      'get_chrome_activity_log',
      'get_connector_policy',
      'get_customer_id',
      'list_org_units',
      'create_default_dlp_rules',
      'check_seb_extension_status',
      'install_seb_extension',
    ].sort()
    assert.deepStrictEqual(
      registeredToolNames.sort(),
      expectedToolNames,
      'The list of registered tool names does not match the expected list.',
    )
  })

  it('should accept and use a shared session state object across tool registrations', async () => {
    const mockAdminSdkClient = {
      listOrgUnits: mock.fn(async () => [{ orgUnitPath: '/Test' }]),
    }

    // This is the state we expect the tools to use
    const sharedState = {
      customerId: 'C_SHARED_123',
      cachedRootOrgUnitId: null,
    }

    // Register tools and pass the shared state
    registerTools(server, { apiClients: { adminSdk: mockAdminSdkClient } }, sharedState)

    // Find the handler for 'list_org_units'
    const listOrgUnitsCall = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_org_units')
    assert.ok(listOrgUnitsCall, 'list_org_units tool should be registered')

    const handler = listOrgUnitsCall.arguments[2]

    // Call the handler without a customerId in the params.
    // If the tool uses the shared state, guardedToolCall will inject 'C_SHARED_123'
    // and skip auto-resolution. If it doesn't use the shared state (the bug),
    // it will try to auto-resolve because its internal state is { customerId: null }.

    // We expect it to use 'C_SHARED_123' and call the mock API client.
    await handler({}, { requestInfo: {} })

    // Verify the mock client was called with the shared customer ID
    assert.strictEqual(mockAdminSdkClient.listOrgUnits.mock.callCount(), 1)
    const callArgs = mockAdminSdkClient.listOrgUnits.mock.calls[0].arguments
    assert.deepStrictEqual(callArgs[0], { customerId: 'C_SHARED_123' })
  })
})
