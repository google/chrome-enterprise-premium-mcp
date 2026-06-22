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
import { registerSearchOrganizationsTool } from '../../tools/definitions/search_organizations.js'

describe('search_organizations Tool', () => {
  let server
  let mockCrmClient
  let mockAdminSdk
  let handler
  let sessionState

  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }

    mockCrmClient = {
      searchOrganizations: mock.fn(async () => ({
        organizations: [
          {
            name: 'organizations/123456789',
            displayName: 'Test Org',
            directoryCustomerId: 'C012345',
            state: 'ACTIVE',
          },
        ],
      })),
    }

    mockAdminSdk = {
      getCustomerId: mock.fn(async () => ({ id: 'C012345' })),
    }

    sessionState = {
      customerId: null,
      organizationId: null,
      organizationName: null,
    }

    const options = {
      cloudResourceManagerClient: mockCrmClient,
      adminSdkClient: mockAdminSdk,
      apiClients: {
        adminSdk: mockAdminSdk,
      },
    }

    registerSearchOrganizationsTool(server, options, sessionState)
    // The handler is the 3rd argument to registerTool
    handler = server.registerTool.mock.calls[0].arguments[2]
  })

  test('registers the search_organizations tool', () => {
    assert.strictEqual(server.registerTool.mock.callCount(), 1)
    assert.strictEqual(server.registerTool.mock.calls[0].arguments[0], 'search_organizations')
  })

  test('handler calls searchOrganizations and caches organization details', async () => {
    const result = await handler(
      { customerId: 'C012345' },
      { requestInfo: { headers: { authorization: 'Bearer mock-token' } } },
    )

    // Verify CRM client was called with correct filter
    assert.strictEqual(mockCrmClient.searchOrganizations.mock.callCount(), 1)
    const callArgs = mockCrmClient.searchOrganizations.mock.calls[0].arguments
    assert.deepStrictEqual(callArgs[0], { filter: 'owner.directorycustomerid:C012345' })
    assert.strictEqual(callArgs[1], 'mock-token')

    // Verify sessionState was updated
    assert.strictEqual(sessionState.organizationId, '123456789')
    assert.strictEqual(sessionState.organizationName, 'organizations/123456789')

    // Verify output content
    assert.ok(result.content[0].text.includes('Associated GCP Organization Found'))
    assert.ok(result.content[0].text.includes('Test Org'))
    assert.ok(result.content[0].text.includes('123456789'))
  })

  test('handler handles no organizations found gracefully', async () => {
    // Override mock to return empty list
    mockCrmClient.searchOrganizations = mock.fn(async () => ({
      organizations: [],
    }))

    const result = await handler(
      { customerId: 'C012345' },
      { requestInfo: { headers: { authorization: 'Bearer mock-token' } } },
    )

    // Verify sessionState was NOT updated
    assert.strictEqual(sessionState.organizationId, null)
    assert.strictEqual(sessionState.organizationName, null)

    // Verify output content
    assert.ok(result.content[0].text.includes('No GCP organization found'))
  })

  test('handler auto-resolves customerId if omitted', async () => {
    // If customerId is omitted, guardedToolCall should resolve it via adminSdk
    await handler({}, { requestInfo: { headers: { authorization: 'Bearer mock-token' } } })

    assert.strictEqual(mockAdminSdk.getCustomerId.mock.callCount(), 1)
    assert.strictEqual(mockCrmClient.searchOrganizations.mock.callCount(), 1)
    const callArgs = mockCrmClient.searchOrganizations.mock.calls[0].arguments
    assert.deepStrictEqual(callArgs[0], { filter: 'owner.directorycustomerid:C012345' })
  })
})
