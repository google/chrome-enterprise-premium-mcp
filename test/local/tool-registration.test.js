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
 * @file Tests for MCP tool registration.
 */

import assert from 'node:assert/strict'
import { describe, test, mock, beforeEach } from 'node:test'
import { registerTools } from '../../tools/index.js'
import { FLAGS } from '../../lib/util/feature_flags.js'
import { SCOPES, OAUTH_SCOPE_REGISTRY } from '../../lib/constants.js'

const CORE_TOOLS = [
  'cep_auth',
  'cep_auth_clear',
  'cep_auth_status',
  'check_and_enable_cep_api',
  'check_cep_subscription',
  'check_seb_extension_status',
  'check_user_cep_license',
  'count_browser_versions',
  'create_chrome_dlp_rule',
  'create_default_dlp_rules',
  'create_regex_detector',
  'create_url_list_detector',
  'create_word_list_detector',
  'enable_chrome_enterprise_connectors',
  'get_chrome_activity_log',
  'get_connector_policy',
  'get_customer_id',
  'get_dlp_rule',
  'get_document',
  'install_seb_extension',
  'list_customer_profiles',
  'list_detectors',
  'list_dlp_rules',
  'list_org_units',
  'search_organizations',
  'security_insights',
]

const DELETE_EXPERIMENT_TOOLS = ['delete_agent_dlp_rule', 'delete_detector']

const DIAGNOSE_EXPERIMENT_TOOLS = ['diagnose_environment']

const KNOWLEDGE_SEARCH_EXPERIMENT_TOOLS = ['search_content', 'list_documents']

const SECURE_GATEWAY_EXPERIMENT_TOOLS = [
  'create_secure_gateway_application',
  'create_secure_gateway',
  'enable_service_discovery',
  'get_secure_gateway',
  'get_secure_gateway_application',
  'get_secure_gateway_application_iam_policy',
  'get_secure_gateway_iam_policy',
  'list_secure_gateway_applications',
  'list_secure_gateways',
  'set_secure_gateway_application_iam_policy',
  'set_secure_gateway_iam_policy',
]

// Tests for SEB tool registration and individual tool handler logic.
describe('SEB Tool Registration', () => {
  let server

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
  })

  // Test if all tools are registered with the server.
  test('When registerTools is called with no experiments, then it registers only core tools', () => {
    registerTools(server, { featureFlags: { isEnabled: () => false } })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    assert.deepStrictEqual(registeredToolNames.sort(), [...CORE_TOOLS].sort())
  })

  test('When registerTools is called with KNOWLEDGE_SEARCH_ENABLED, then it registers core + search tools', () => {
    registerTools(server, {
      featureFlags: {
        isEnabled: flag => flag === FLAGS.KNOWLEDGE_SEARCH_ENABLED,
      },
    })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    const expected = [...CORE_TOOLS, ...KNOWLEDGE_SEARCH_EXPERIMENT_TOOLS].sort()
    assert.deepStrictEqual(registeredToolNames.sort(), expected)
  })

  test('When registerTools is called with DELETE_TOOL_ENABLED, then it registers core + delete tools', () => {
    registerTools(server, {
      featureFlags: {
        isEnabled: flag => flag === FLAGS.DELETE_TOOL_ENABLED,
      },
    })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    const expected = [...CORE_TOOLS, ...DELETE_EXPERIMENT_TOOLS].sort()
    assert.deepStrictEqual(registeredToolNames.sort(), expected)
  })

  test('When registerTools is called with DIAGNOSE_TOOL_ENABLED, then it registers core + diagnose tools', () => {
    registerTools(server, {
      featureFlags: {
        isEnabled: flag => flag === FLAGS.DIAGNOSE_TOOL_ENABLED,
      },
    })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    const expected = [...CORE_TOOLS, ...DIAGNOSE_EXPERIMENT_TOOLS].sort()
    assert.deepStrictEqual(registeredToolNames.sort(), expected)
  })

  test('When registerTools is called with SECURE_GATEWAY_ENABLED, then it registers core + secure gateway tools', () => {
    registerTools(server, {
      featureFlags: {
        isEnabled: flag => flag === FLAGS.SECURE_GATEWAY_ENABLED,
      },
    })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    const expected = [...CORE_TOOLS, ...SECURE_GATEWAY_EXPERIMENT_TOOLS].sort()
    assert.deepStrictEqual(registeredToolNames.sort(), expected)
  })

  test('When SECURE_GATEWAY_ENABLED and DELETE_TOOL_ENABLED are active, then it registers delete_secure_gateway_application', () => {
    registerTools(server, {
      featureFlags: {
        isEnabled: flag => flag === FLAGS.SECURE_GATEWAY_ENABLED || flag === FLAGS.DELETE_TOOL_ENABLED,
      },
    })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    const expected = [
      ...CORE_TOOLS,
      ...DELETE_EXPERIMENT_TOOLS,
      ...SECURE_GATEWAY_EXPERIMENT_TOOLS,
      'delete_secure_gateway_application',
    ].sort()
    assert.deepStrictEqual(registeredToolNames.sort(), expected)
  })
  test('When registerEnableApi is false, then check_and_enable_cep_api is not registered', () => {
    registerTools(server, { featureFlags: { isEnabled: () => false }, registerEnableApi: false })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    assert.ok(!registeredToolNames.includes('check_and_enable_cep_api'))
  })

  test('When registerEnableApi is omitted, then check_and_enable_cep_api is registered', () => {
    registerTools(server, { featureFlags: { isEnabled: () => false } })

    const registeredToolNames = server.registerTool.mock.calls.map(call => call.arguments[0])
    assert.ok(registeredToolNames.includes('check_and_enable_cep_api'))
  })

  test('When a shared session state is provided, then it is used across tool registrations', async () => {
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

  describe('Scope Registry Integrity', () => {
    test('Every scope URL in the SCOPES constant must have an entry in OAUTH_SCOPE_REGISTRY', () => {
      for (const [id, url] of Object.entries(SCOPES)) {
        assert.ok(
          OAUTH_SCOPE_REGISTRY[url],
          `Scope "${id}" with URL "${url}" is missing from OAUTH_SCOPE_REGISTRY in lib/constants.js`,
        )
        assert.ok(OAUTH_SCOPE_REGISTRY[url].name, `Scope "${url}" in registry is missing a human-readable "name"`)
        assert.ok(OAUTH_SCOPE_REGISTRY[url].category, `Scope "${url}" in registry is missing a functional "category"`)
      }
    })

    test('Every tool registered in the codebase must use scopes that exist in the Registry', () => {
      const server = {
        registerTool: mock.fn(),
      }

      // Register ALL tools (including experiments) to audit their scopes
      registerTools(server, {
        featureFlags: { isEnabled: () => true },
      })

      const registeredTools = server.registerTool.mock.calls

      for (const call of registeredTools) {
        const toolName = call.arguments[0]
        const handler = call.arguments[2]
        const requestedScopes = handler._scopes || Object.values(SCOPES)

        for (const url of requestedScopes) {
          assert.ok(
            OAUTH_SCOPE_REGISTRY[url],
            `Tool "${toolName}" requests scope "${url}" which is NOT found in the Registry. ` +
              `Update OAUTH_SCOPE_CONFIG in lib/constants.js.`,
          )
        }
      }
    })
  })
})
