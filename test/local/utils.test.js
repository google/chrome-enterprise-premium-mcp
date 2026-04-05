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
import { validateAndGetOrgUnitId, commonTransform, guardedToolCall, resolveRootOrgUnitId } from '../../tools/utils.js'
import { registerTools } from '../../tools/tools.js'

describe('Tool Utils', () => {
  describe('commonTransform', () => {
    it('should strip "id:" prefix from orgUnitId', () => {
      const params = { orgUnitId: 'id:12345' }
      const transformed = commonTransform(params)
      assert.strictEqual(transformed.orgUnitId, '12345')
    })

    it('should not modify other parameters', () => {
      const params = { customerId: 'C123', orgUnitId: '12345', other: 'value' }
      const transformed = commonTransform(params)
      assert.deepStrictEqual(transformed, { customerId: 'C123', orgUnitId: '12345', other: 'value' })
    })
  })

  describe('validateAndGetOrgUnitId', () => {
    it('should return the same ID if it does not start with "id:"', () => {
      assert.strictEqual(validateAndGetOrgUnitId('12345'), '12345')
    })

    it('should strip "id:" prefix', () => {
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
      it('should auto-resolve customerId using provided adminSdk client and apiOptions during tool registration', async () => {
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
      it('should update sessionState.customerId when params.customerId is provided', async () => {
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

    describe('First-Call Injection (hasInjectedSystemPrompt)', () => {
      it('should inject system prompt on the first tool call and update session state', async () => {
        const handler = async () => {
          return { content: [{ type: 'text', text: 'Original content' }] }
        }
        const sessionState = { hasInjectedSystemPrompt: false, history: [] }
        const tool = guardedToolCall({ handler }, {}, sessionState)

        // First call
        const result1 = await tool({}, {})

        assert.strictEqual(sessionState.hasInjectedSystemPrompt, true)
        assert.strictEqual(result1.content.length, 2)
        assert.strictEqual(result1.content[0].text, 'Original content')
        assert.ok(
          result1.content[1].text.includes(
            '[AGENT DIRECTIVE] You are a specialized Chrome Enterprise Premium (CEP) security expert.',
          ),
        )

        // Second call
        const result2 = await tool({}, {})

        // Should not inject again
        assert.strictEqual(result2.content.length, 1)
        assert.strictEqual(result2.content[0].text, 'Original content')
      })
    })

    describe('Root OrgUnit Auto-Resolution (resolveRootOrgUnitId helper)', () => {
      it('should resolve root orgUnitId and cache it', async () => {
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

      it('should use cached root orgUnitId if available', async () => {
        const mockListOrgUnits = mock.fn()

        const apiClients = {
          adminSdk: { listOrgUnits: mockListOrgUnits },
        }
        const sessionState = { cachedRootOrgUnitId: 'cached-root-id' }

        const result = await resolveRootOrgUnitId(apiClients, 'C123', 'token', sessionState)

        assert.strictEqual(mockListOrgUnits.mock.callCount(), 0)
        assert.strictEqual(result, 'cached-root-id')
      })

      it('should return null if root OU is not found', async () => {
        const mockListOrgUnits = mock.fn(async () => ({
          organizationUnits: [{ orgUnitId: 'child-id', orgUnitPath: '/child' }],
        }))
        const apiClients = { adminSdk: { listOrgUnits: mockListOrgUnits } }
        const sessionState = { cachedRootOrgUnitId: null }

        const result = await resolveRootOrgUnitId(apiClients, 'C123', 'token', sessionState)

        assert.strictEqual(result, null)
      })
    })

    it('should return a 401 error object when handler fails with 401', async () => {
      const handler = async () => {
        const error = new Error('Permission denied')
        error.code = 401
        throw error
      }
      const tool = guardedToolCall({ handler })

      await assert.rejects(tool({}, {}), {
        code: 401,
        message: 'Authentication required. Please check your credentials.',
      })
    })

    it('should return a 403 error object when handler fails with 403', async () => {
      const handler = async () => {
        const error = new Error('Permission denied')
        error.code = 403
        throw error
      }
      const tool = guardedToolCall({ handler })

      await assert.rejects(tool({}, {}), {
        code: 403,
        message: 'Permission denied. Your account lacks the required permissions.',
      })
    })

    it('should call onError if provided when handler fails', async () => {
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
