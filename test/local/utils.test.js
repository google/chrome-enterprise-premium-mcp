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
import { validateAndGetOrgUnitId, resolveRootOrgUnitId } from '../../tools/utils/org-unit.js'
import { commonTransform, guardedToolCall } from '../../tools/utils/wrapper.js'
import { registerTools } from '../../tools/index.js'

describe('Tool Utils', () => {
  describe('commonTransform', () => {
    test('When orgUnitId has id: prefix, then it strips it', () => {
      const params = { orgUnitId: 'id:12345' }
      const transformed = commonTransform(params)
      assert.strictEqual(transformed.orgUnitId, '12345')
    })

    test('When other parameters are provided, then it does not modify them', () => {
      const params = { customerId: 'C123', orgUnitId: '12345', other: 'value' }
      const transformed = commonTransform(params)
      assert.deepStrictEqual(transformed, { customerId: 'C123', orgUnitId: '12345', other: 'value' })
    })
  })

  describe('validateAndGetOrgUnitId', () => {
    test('When ID does not start with "id:", then it returns the same ID', () => {
      assert.strictEqual(validateAndGetOrgUnitId('12345'), '12345')
    })

    test('When ID starts with "id:", then it strips the prefix', () => {
      assert.strictEqual(validateAndGetOrgUnitId('id:12345'), '12345')
    })
  })

  describe('guardedToolCall Infrastructure', () => {
    let server

    beforeEach(() => {
      server = {
        registerTool: mock.fn(),
      }
    })

    describe('Registration and Auto-Resolution', () => {
      test('When tools are registered, then it auto-resolves customerId using provided adminSdk client and apiOptions', async () => {
        const mockGetCustomerId = mock.fn(async (authToken, apiOptions) => {
          if (apiOptions?.rootUrl === 'http://fake-api') {
            return { id: 'C_AUTO' }
          }
          return { id: 'C_WRONG_ROOT' }
        })
        const mockCountBrowserVersions = mock.fn(async () => [])

        const apiClients = {
          adminSdk: { getCustomerId: mockGetCustomerId },
          chromeManagement: { countBrowserVersions: mockCountBrowserVersions },
          cloudIdentity: {},
          chromePolicy: {},
        }
        const apiOptions = { rootUrl: 'http://fake-api' }

        // Register tools as it's done in mcp-server.js
        registerTools(server, { apiClients, apiOptions })

        // Find the count_browser_versions tool handler
        const countBrowserVersionsReg = server.registerTool.mock.calls.find(
          call => call.arguments[0] === 'count_browser_versions',
        )
        const handler = countBrowserVersionsReg.arguments[2]

        // Execute the handler without a customerId
        await handler({}, { requestInfo: { headers: { authorization: 'Bearer token' } } })

        // Verify that getCustomerId was called with the correct arguments
        assert.strictEqual(mockGetCustomerId.mock.callCount(), 1, 'getCustomerId should have been called')
        assert.strictEqual(mockGetCustomerId.mock.calls[0].arguments[0], 'token')
        assert.deepStrictEqual(mockGetCustomerId.mock.calls[0].arguments[1], apiOptions)

        // Verify that the resolved customerId was passed to the actual handler
        assert.strictEqual(mockCountBrowserVersions.mock.callCount(), 1)
        assert.strictEqual(
          mockCountBrowserVersions.mock.calls[0].arguments[0],
          'C_AUTO',
          'customerId should be auto-resolved to C_AUTO',
        )
      })
    })

    describe('Caching logic integration', () => {
      test('When params.customerId is provided, then it updates sessionState.customerId', async () => {
        const handler = async params => {
          return { params }
        }
        const sessionState = { customerId: null }
        const tool = guardedToolCall({ handler }, {}, sessionState)

        // First call with a customerId
        await tool({ customerId: 'C123' }, {})

        // Second call without a customerId
        const result = await tool({}, {})

        // Check if the cached customerId was used
        assert.strictEqual(result.params.customerId, 'C123')
        assert.strictEqual(sessionState.customerId, 'C123')
      })
    })

    describe('Root OrgUnit Auto-Resolution (resolveRootOrgUnitId helper)', () => {
      test('When resolveRootOrgUnitId is called, then it resolves root orgUnitId and caches it', async () => {
        const mockListOrgUnits = mock.fn(async () => ({
          organizationUnits: [
            { orgUnitId: 'root-id', orgUnitPath: '/' },
            { orgUnitId: 'child-id', orgUnitPath: '/child' },
          ],
        }))

        const apiClients = {
          adminSdk: { listOrgUnits: mockListOrgUnits },
        }
        const sessionState = { cachedRootOrgUnitId: null }

        const result = await resolveRootOrgUnitId(apiClients, 'C123', 'token', sessionState)

        assert.strictEqual(mockListOrgUnits.mock.callCount(), 1)
        assert.strictEqual(result, 'root-id')
        assert.strictEqual(sessionState.cachedRootOrgUnitId, 'root-id')
      })

      test('When cached root orgUnitId is available, then it uses it without calling API', async () => {
        const mockListOrgUnits = mock.fn()

        const apiClients = {
          adminSdk: { listOrgUnits: mockListOrgUnits },
        }
        const sessionState = { cachedRootOrgUnitId: 'cached-root-id' }

        const result = await resolveRootOrgUnitId(apiClients, 'C123', 'token', sessionState)

        assert.strictEqual(mockListOrgUnits.mock.callCount(), 0)
        assert.strictEqual(result, 'cached-root-id')
      })

      test('When root OU is not found, then it returns null', async () => {
        const mockListOrgUnits = mock.fn(async () => ({
          organizationUnits: [{ orgUnitId: 'child-id', orgUnitPath: '/child' }],
        }))
        const apiClients = { adminSdk: { listOrgUnits: mockListOrgUnits } }
        const sessionState = { cachedRootOrgUnitId: null }

        const result = await resolveRootOrgUnitId(apiClients, 'C123', 'token', sessionState)

        assert.strictEqual(result, null)
      })
    })

    test('When handler fails with 401, then it returns a proactive remediation message', async () => {
      const handler = async () => {
        const error = new Error('Unauthorized')
        error.status = 401
        throw error
      }
      const tool = guardedToolCall({ handler })

      const result = await tool({}, {})

      assert.strictEqual(result.isError, true)
      assert.ok(result.content[0].text.includes('Authentication required'))
      assert.ok(result.content[0].text.includes('gcloud auth application-default login'))
      assert.ok(!result.structuredContent)
    })

    test('When handler fails with 403, then it returns a proactive remediation message without structuredContent', async () => {
      const handler = async () => {
        const error = new Error('Forbidden')
        error.status = 403
        throw error
      }
      const tool = guardedToolCall({ handler })

      const result = await tool({}, {})

      assert.strictEqual(result.isError, true)
      assert.ok(result.content[0].text.includes('Permission denied'))
      assert.ok(result.content[0].text.includes('gcloud auth application-default login'))
      assert.ok(result.content[0].text.includes('admin.googleapis.com'))
      assert.ok(!result.structuredContent)
    })

    test('When handler fails with invalid_grant, then it returns a proactive remediation message', async () => {
      const handler = async () => {
        throw new Error('API Error: invalid_grant - reauth related error (invalid_rapt)')
      }
      const tool = guardedToolCall({ handler })

      const result = await tool({}, {})

      assert.strictEqual(result.isError, true)
      assert.ok(result.content[0].text.includes('Authentication required'))
      assert.ok(result.content[0].text.includes('gcloud auth application-default login'))
      assert.ok(!result.structuredContent)
    })

    test('When handler fails with 401 and an auth header is present, then it returns an OAuth remediation message', async () => {
      const handler = async () => {
        const error = new Error('Unauthorized')
        error.status = 401
        throw error
      }
      const tool = guardedToolCall({ handler })

      const context = { requestInfo: { headers: { authorization: 'Bearer SOME_TOKEN' } } }
      const result = await tool({}, context)

      assert.strictEqual(result.isError, true)
      assert.ok(result.content[0].text.includes('Authentication required'))
      assert.ok(result.content[0].text.includes('/mcp reauth'))
      assert.ok(!result.content[0].text.includes('gcloud auth application-default login'))
    })

    test('When handler fails with 403 and an auth header is present, then it returns an OAuth remediation message', async () => {
      const handler = async () => {
        const error = new Error('Forbidden')
        error.status = 403
        throw error
      }
      const tool = guardedToolCall({ handler })

      const context = { requestInfo: { headers: { authorization: 'Bearer SOME_TOKEN' } } }
      const result = await tool({}, context)

      assert.strictEqual(result.isError, true)
      assert.ok(result.content[0].text.includes('Permission denied'))
      assert.ok(result.content[0].text.includes('/mcp reauth'))
      assert.ok(result.content[0].text.includes('admin.googleapis.com'))
      assert.ok(!result.content[0].text.includes('gcloud auth application-default login'))
    })

    test('When onError is provided and handler fails, then it calls onError', async () => {
      const handler = async () => {
        throw new Error('Test error')
      }
      const customResponse = { isError: true, content: [{ type: 'text', text: 'Custom Error' }] }
      const onError = mock.fn(() => customResponse)
      const tool = guardedToolCall({ handler }, { onError })

      const result = await tool({}, {})
      assert.strictEqual(onError.mock.callCount(), 1)
      assert.deepStrictEqual(result, customResponse)
    })
  })
})
