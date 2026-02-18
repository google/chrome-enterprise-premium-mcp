import assert from 'node:assert/strict'
import { describe, it, mock, beforeEach } from 'node:test'
import esmock from 'esmock'
import { guardedToolCall } from '../../tools/utils.js'

describe('Customer ID Caching and Auto-Resolution', () => {
    let server

    beforeEach(() => {
        server = {
            registerTool: mock.fn(),
        }
    })

    it('should fetch customerId on first tool call and cache it for subsequent calls', async () => {
        const mockGetCustomerId = mock.fn(async () => ({ id: 'C_AUTO_RESOLVED' }))
        const mockListOrgUnits = mock.fn(async () => [])
        const MockAdminSdkClient = class {
            constructor() {
                this.getCustomerId = mockGetCustomerId
                this.listOrgUnits = mockListOrgUnits
            }
        }
        const adminSdkClientInstance = new MockAdminSdkClient()

        const listOrgUnitsHandler = guardedToolCall(
            {
                handler: async (params, context) => {
                    return adminSdkClientInstance.listOrgUnits(params)
                },
            },
            { apiClients: { adminSdk: adminSdkClientInstance } },
        )

        // --- First Call ---
        await listOrgUnitsHandler({}, { requestInfo: {} })
        assert.strictEqual(mockGetCustomerId.mock.callCount(), 1, 'getCustomerId should be called once')
        const firstCallArgs = mockListOrgUnits.mock.calls[0].arguments
        assert.strictEqual(firstCallArgs[0].customerId, 'C_AUTO_RESOLVED', 'First call should use resolved ID')

        // --- Second Call ---
        await listOrgUnitsHandler({}, { requestInfo: {} })
        assert.strictEqual(mockGetCustomerId.mock.callCount(), 1, 'getCustomerId should NOT be called again')
        const secondCallArgs = mockListOrgUnits.mock.calls[1].arguments
        assert.strictEqual(secondCallArgs[0].customerId, 'C_AUTO_RESOLVED', 'Second call should use cached ID')
    })

    it('should respect explicitly provided customerId and not overwrite cache if different', async () => {
        const mockGetCustomerId = mock.fn(async () => ({ id: 'C_DEFAULT' }))
        const mockListOrgUnits = mock.fn(async () => [])
        const MockAdminSdkClient = class {
            constructor() {
                this.getCustomerId = mockGetCustomerId
                this.listOrgUnits = mockListOrgUnits
            }
        }
        const adminSdkClientInstance = new MockAdminSdkClient()

        const listOrgUnitsHandler = guardedToolCall(
            {
                handler: async (params, context) => {
                    return adminSdkClientInstance.listOrgUnits(params)
                },
            },
            { apiClients: { adminSdk: adminSdkClientInstance } },
        )

        // Call with explicit ID
        await listOrgUnitsHandler({ customerId: 'C_EXPLICIT' }, { requestInfo: {} })
        assert.strictEqual(mockGetCustomerId.mock.callCount(), 0)
        assert.strictEqual(mockListOrgUnits.mock.calls[0].arguments[0].customerId, 'C_EXPLICIT')
    })
})
