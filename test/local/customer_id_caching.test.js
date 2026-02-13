import assert from 'node:assert/strict'
import { describe, it, mock, beforeEach } from 'node:test'
import esmock from 'esmock'

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

        // Mock the API modules
        // We need to ensure tools/utils.js uses our mocked getCustomerId
        const { registerTools } = await esmock(
            '../../tools/tools.js',
            {},
            {
                '../../lib/api/admin_sdk.js': {
                    listOrgUnits: mockListOrgUnits,
                    getCustomerId: mockGetCustomerId,
                },
            },
        )

        // Register tools
        registerTools(server, { gcpCredentialsAvailable: true })

        // Get the tool handler for list_org_units
        const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_org_units').arguments[2]

        // --- First Call ---
        // Call without customerId. Should trigger auto-resolve.
        await handler({}, { requestInfo: {} })

        // Verify getCustomerId was called
        assert.strictEqual(mockGetCustomerId.mock.callCount(), 1, 'getCustomerId should be called once')

        // Verify listOrgUnits received the resolved ID
        const firstCallArgs = mockListOrgUnits.mock.calls[0].arguments
        assert.strictEqual(firstCallArgs[0].customerId, 'C_AUTO_RESOLVED', 'First call should use resolved ID')

        // --- Second Call ---
        // Call again without customerId. Should use cached value.
        await handler({}, { requestInfo: {} })

        // Verify getCustomerId was NOT called again
        assert.strictEqual(mockGetCustomerId.mock.callCount(), 1, 'getCustomerId should NOT be called again')

        // Verify listOrgUnits still received the ID
        const secondCallArgs = mockListOrgUnits.mock.calls[1].arguments
        assert.strictEqual(secondCallArgs[0].customerId, 'C_AUTO_RESOLVED', 'Second call should use cached ID')
    })

    it('should respect explicitly provided customerId and not overwrite cache if different', async () => {
        // This test ensures that if a user explicitly provides an ID, it is used,
        // but the global cache (if set) remains or is set?
        // Actually gcpTool logic: if args.customerId is present, it uses it.
        // It only auto-resolves if args.customerId is undefined or 'me'.

        const mockGetCustomerId = mock.fn(async () => ({ id: 'C_DEFAULT' }))
        const mockListOrgUnits = mock.fn(async () => [])

        const { registerTools } = await esmock(
            '../../tools/tools.js',
            {},
            {
                '../../lib/api/admin_sdk.js': {
                    listOrgUnits: mockListOrgUnits,
                    getCustomerId: mockGetCustomerId,
                },
            },
        )

        registerTools(server, { gcpCredentialsAvailable: true })
        const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_org_units').arguments[2]

        // Call with explicit ID
        await handler({ customerId: 'C_EXPLICIT' }, { requestInfo: {} })

        // getCustomerId should NOT be called
        assert.strictEqual(mockGetCustomerId.mock.callCount(), 0)

        // listOrgUnits should use explicit ID
        assert.strictEqual(mockListOrgUnits.mock.calls[0].arguments[0].customerId, 'C_EXPLICIT')
    })
})
