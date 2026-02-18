import assert from 'node:assert/strict'
import { describe, it, mock, beforeEach } from 'node:test'
import esmock from 'esmock'

describe('Chrome Management API', () => {
    let server
    let mockCountBrowserVersions
    let mockListCustomerProfiles
    let registerTools

    beforeEach(async () => {
        server = {
            registerTool: mock.fn(),
        }
    })

    describe('count_browser_versions Tool', () => {
        it('should call countBrowserVersions and return formatted result', async () => {
            const mockCountBrowserVersions = mock.fn(async () => [
                { version: '120.0.6099.71', count: 10, channel: 'Stable' },
                { version: '119.0.0.0', count: 5, channel: 'Beta' },
            ])
            const MockChromeManagementClient = class {
                constructor() {
                    this.countBrowserVersions = mockCountBrowserVersions
                }
            }

            const { registerTools } = await esmock(
                '../../tools/tools.js',
                {},
                {
                    '../../lib/api/real_chrome_management_client.js': {
                        RealChromeManagementClient: MockChromeManagementClient,
                    },
                },
            )
            registerTools(server, {
                gcpCredentialsAvailable: true,
                apiClients: { chromeManagement: new MockChromeManagementClient() },
            })

            const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'count_browser_versions')
                .arguments[2]

            const result = await handler(
                { project: 'test-project', customerId: 'C0123' },
                {}, // Added mock context
            )

            assert.strictEqual(mockCountBrowserVersions.mock.callCount(), 1)
            const expectedText =
                'Browser versions for customer C0123:\n' +
                '- 120.0.6099.71 (10 devices) - Stable\n' +
                '- 119.0.0.0 (5 devices) - Beta'
            assert.deepStrictEqual(result.content[0].text, expectedText)
        })

        // Test error handling when the API call fails.
        it('should return an error message if API call fails', async () => {
            const mockCountBrowserVersions = mock.fn(async () => {
                throw new Error('API Error')
            })
            const MockChromeManagementClient = class {
                constructor() {
                    this.countBrowserVersions = mockCountBrowserVersions
                }
            }

            const { registerTools } = await esmock(
                '../../tools/tools.js',
                {},
                {
                    '../../lib/api/real_chrome_management_client.js': {
                        RealChromeManagementClient: MockChromeManagementClient,
                    },
                },
            )
            registerTools(server, {
                gcpCredentialsAvailable: true,
                apiClients: { chromeManagement: new MockChromeManagementClient() },
            })

            const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'count_browser_versions')
                .arguments[2]

            const result = await handler(
                { project: 'test-project', customerId: 'C0123' },
                {}, // Added mock context
            )
            assert.deepStrictEqual(result.content[0].text, 'Error: API Error')
        })
    })

    describe('list_customer_profiles Tool', () => {
        it('should call listCustomerProfiles and return formatted result', async () => {
            const mockListCustomerProfiles = mock.fn(async () => [
                { name: 'profile1', value: 'value1' },
                { name: 'profile2', value: 'value2' },
            ])
            const MockChromeManagementClient = class {
                constructor() {
                    this.listCustomerProfiles = mockListCustomerProfiles
                }
            }

            const { registerTools } = await esmock(
                '../../tools/tools.js',
                {},
                {
                    '../../lib/api/real_chrome_management_client.js': {
                        RealChromeManagementClient: MockChromeManagementClient,
                    },
                },
            )
            registerTools(server, {
                gcpCredentialsAvailable: true,
                apiClients: { chromeManagement: new MockChromeManagementClient() },
            })

            const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_customer_profiles')
                .arguments[2]

            const result = await handler({ customerId: 'C0123' }, {})

            assert.strictEqual(mockListCustomerProfiles.mock.callCount(), 1)
            const expectedText =
                'Customer profiles for customer C0123:\n' +
                '[\n' +
                '  {\n' +
                '    "name": "profile1",\n' +
                '    "value": "value1"\n' +
                '  },\n' +
                '  {\n' +
                '    "name": "profile2",\n' +
                '    "value": "value2"\n' +
                '  }\n' +
                ']'
            assert.deepStrictEqual(result.content[0].text, expectedText)
        })

        it('should return an error message if API call fails', async () => {
            const mockListCustomerProfiles = mock.fn(async () => {
                throw new Error('API Error')
            })
            const MockChromeManagementClient = class {
                constructor() {
                    this.listCustomerProfiles = mockListCustomerProfiles
                }
            }

            const { registerTools } = await esmock(
                '../../tools/tools.js',
                {},
                {
                    '../../lib/api/real_chrome_management_client.js': {
                        RealChromeManagementClient: MockChromeManagementClient,
                    },
                },
            )
            registerTools(server, {
                gcpCredentialsAvailable: true,
                apiClients: { chromeManagement: new MockChromeManagementClient() },
            })

            const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_customer_profiles')
                .arguments[2]

            const result = await handler({ customerId: 'C0123' }, {})
            assert.deepStrictEqual(result.content[0].text, 'Error listing customer profiles: API Error')
        })
    })
})
