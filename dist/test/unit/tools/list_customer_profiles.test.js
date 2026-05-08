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
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { registerCustomerProfileTool } from '../../../tools/definitions/list_customer_profiles.js'
describe('list_customer_profiles tool handler', () => {
  const getHandler = mockChromeManagementClient => {
    let registeredHandler
    const mockServer = {
      registerTool(name, config, handler) {
        if (name === 'list_customer_profiles') {
          registeredHandler = handler
        }
      },
    }
    registerCustomerProfileTool(mockServer, { chromeManagementClient: mockChromeManagementClient }, {})
    return registeredHandler
  }
  const mockContext = {
    requestInfo: {
      headers: {
        authorization: 'Bearer token',
      },
    },
  }
  test('When no profiles are found, then it returns a graceful empty message', async () => {
    const mockClient = {
      listCustomerProfiles: async () => [],
    }
    const handler = getHandler(mockClient)
    const result = await handler({ customerId: 'C012345' }, mockContext)
    assert.match(result.content[0].text, /No profiles found/)
    assert.deepStrictEqual(result.structuredContent.profiles, [])
    assert.strictEqual(result.structuredContent.totalCount, 0)
  })
  test('When profiles are returned, then it formats them and includes a resource map', async () => {
    const mockProfiles = [
      {
        name: 'customers/C012345/profiles/abc123',
        displayName: 'Test User',
        userEmail: 'user@example.com',
        osPlatformType: 'LINUX',
        osVersion: '22.04',
        profileId: 'abc123',
      },
    ]
    const mockClient = {
      listCustomerProfiles: async () => mockProfiles,
    }
    const handler = getHandler(mockClient)
    const result = await handler({ customerId: 'C012345' }, mockContext)
    const text = result.content[0].text
    assert.match(text, /## Browser Profiles \(1\)/)
    assert.match(text, /\*\*Test User\*\*/)
    assert.match(text, /Email: user@example.com/)
    assert.match(text, /OS: LINUX 22\.04/)
    assert.match(text, /"Test User" → `customers\/C012345\/profiles\/abc123`/)
    assert.deepStrictEqual(result.structuredContent.profiles, mockProfiles)
    assert.strictEqual(result.structuredContent.totalCount, 1)
  })
  test('When a profile has missing fields, then it falls back to safe defaults', async () => {
    const mockProfiles = [
      {
        name: 'customers/C012345/profiles/xyz999',
      },
    ]
    const mockClient = {
      listCustomerProfiles: async () => mockProfiles,
    }
    const handler = getHandler(mockClient)
    const result = await handler({ customerId: 'C012345' }, mockContext)
    const text = result.content[0].text
    assert.match(text, /Unnamed Profile/)
    assert.match(text, /Email: Unknown/)
    assert.match(text, /OS: Unknown/)
  })
  test('When the client throws an auth error, then isError is true and it is not swallowed', async () => {
    const authError = new Error('API Error 401: Unauthorized')
    authError.status = 401
    const mockClient = {
      listCustomerProfiles: async () => {
        throw authError
      },
    }
    const handler = getHandler(mockClient)
    const result = await handler({ customerId: 'C012345' }, mockContext)
    assert.strictEqual(result.isError, true)
    // The auth remediation message (not the swallowed error shape) should appear
    assert.ok(!result.structuredContent?.error, 'error flag must not be buried in structuredContent')
  })
  test('When the client throws a generic error, then isError is true and the message surfaces', async () => {
    const mockClient = {
      listCustomerProfiles: async () => {
        throw new Error('Network timeout')
      },
    }
    const handler = getHandler(mockClient)
    const result = await handler({ customerId: 'C012345' }, mockContext)
    assert.strictEqual(result.isError, true)
    assert.match(result.content[0].text, /Network timeout/)
    assert.ok(!result.structuredContent?.error, 'error flag must not be buried in structuredContent')
  })
})
