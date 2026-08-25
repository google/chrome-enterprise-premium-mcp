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
import esmock from 'esmock'

describe('Chrome Management API', () => {
  let server

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
  })

  describe('count_browser_versions Tool', () => {
    test('When tool is executed, then it calls countBrowserVersions and returns formatted result', async () => {
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
        '../../tools/index.js',
        {},
        {
          '../../lib/api/chrome_management_client.js': {
            ChromeManagementClient: MockChromeManagementClient,
          },
        },
      )
      registerTools(server, {
        apiClients: { chromeManagement: new MockChromeManagementClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'count_browser_versions')
        .arguments[2]

      const result = await handler(
        { project: 'test-project', customerId: 'C0123' },
        {}, // Added mock context
      )

      assert.strictEqual(mockCountBrowserVersions.mock.callCount(), 1)
      assert.ok(result.content[0].text.includes('## Browser Versions (2)'))
      assert.ok(result.content[0].text.includes('**120.0.6099.71**'))
      assert.ok(result.content[1].text.includes('```json'))
    })

    // Test error handling when the API call fails.
    test('When API call fails, then it returns an error message', async () => {
      const mockCountBrowserVersions = mock.fn(async () => {
        throw new Error('API Error')
      })
      const MockChromeManagementClient = class {
        constructor() {
          this.countBrowserVersions = mockCountBrowserVersions
        }
      }

      const { registerTools } = await esmock(
        '../../tools/index.js',
        {},
        {
          '../../lib/api/chrome_management_client.js': {
            ChromeManagementClient: MockChromeManagementClient,
          },
        },
      )
      registerTools(server, {
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
    test('When tool is executed, then it calls listCustomerProfiles and returns formatted result', async () => {
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
        '../../tools/index.js',
        {},
        {
          '../../lib/api/chrome_management_client.js': {
            ChromeManagementClient: MockChromeManagementClient,
          },
        },
      )
      registerTools(server, {
        apiClients: { chromeManagement: new MockChromeManagementClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_customer_profiles')
        .arguments[2]

      const result = await handler({ customerId: 'C0123' }, {})

      assert.strictEqual(mockListCustomerProfiles.mock.callCount(), 1)
      assert.ok(result.content[0].text.includes('## Browser Profiles (2)'))
      assert.ok(result.content[0].text.includes('Profile: `profile1`'))
      assert.ok(result.content[1].text.includes('```json'))
    })

    test('When API call fails, then it surfaces as isError so guardedToolCall can run auth remediation', async () => {
      const mockListCustomerProfiles = mock.fn(async () => {
        throw new Error('API Error')
      })
      const MockChromeManagementClient = class {
        constructor() {
          this.listCustomerProfiles = mockListCustomerProfiles
        }
      }

      const { registerTools } = await esmock(
        '../../tools/index.js',
        {},
        {
          '../../lib/api/chrome_management_client.js': {
            ChromeManagementClient: MockChromeManagementClient,
          },
        },
      )
      registerTools(server, {
        apiClients: { chromeManagement: new MockChromeManagementClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_customer_profiles')
        .arguments[2]

      const result = await handler({ customerId: 'C0123' }, {})
      assert.strictEqual(result.isError, true)
      assert.match(result.content[0].text, /API Error/)
    })
  })

  describe('ChromeManagementClient authToken threading', () => {
    test('When countBrowserVersions is called with an authToken, then it is forwarded to getClient', async () => {
      const { ChromeManagementClient } = await import('../../lib/api/chrome_management_client.js')
      const client = new ChromeManagementClient()
      let observedAuth = 'sentinel-not-set'
      client.getClient = async authToken => {
        observedAuth = authToken
        return {
          customers: {
            reports: {
              countChromeVersions: async () => ({ data: { browserVersions: [] } }),
            },
          },
        }
      }
      await client.countBrowserVersions('C0123', null, 'TEST_BEARER_TOKEN')
      assert.strictEqual(observedAuth, 'TEST_BEARER_TOKEN')
    })

    test('When listCustomerProfiles is called with an authToken, then it is forwarded to getClient', async () => {
      const { ChromeManagementClient } = await import('../../lib/api/chrome_management_client.js')
      const client = new ChromeManagementClient()
      let observedAuth = 'sentinel-not-set'
      client.getClient = async authToken => {
        observedAuth = authToken
        return {
          customers: {
            profiles: {
              list: async () => ({ data: { chromeBrowserProfiles: [] } }),
            },
          },
        }
      }
      await client.listCustomerProfiles('C0123', 'TEST_BEARER_TOKEN')
      assert.strictEqual(observedAuth, 'TEST_BEARER_TOKEN')
    })

    test('When checkSecurityInsightsStatus is called with an authToken, then it threads to getClient and resolveCustomerId', async () => {
      const { ChromeManagementClient } = await import('../../lib/api/chrome_management_client.js')
      const client = new ChromeManagementClient()
      let observedAuth = 'sentinel-not-set'
      client.resolveCustomerId = async (customerId, authToken) => {
        assert.strictEqual(authToken, 'TEST_BEARER_TOKEN')
        return 'C0123'
      }
      client.getClient = async authToken => {
        observedAuth = authToken
        return {
          customers: {
            enterprise: {
              securityInsights: {
                checkEnablementStatus: async () => ({ data: { insightsState: 'INSIGHTS_DISABLED' } }),
              },
            },
          },
        }
      }
      const result = await client.checkSecurityInsightsStatus('my_customer', 'TEST_BEARER_TOKEN')
      assert.strictEqual(observedAuth, 'TEST_BEARER_TOKEN')
      assert.deepStrictEqual(result, { insightsState: 'INSIGHTS_DISABLED' })
    })

    test('When enableSecurityInsights is called with an authToken and targetOus, then it threads correctly', async () => {
      const { ChromeManagementClient } = await import('../../lib/api/chrome_management_client.js')
      const client = new ChromeManagementClient()
      let observedAuth = 'sentinel-not-set'
      let observedData = null
      client.resolveCustomerId = async (_customerId, _authToken) => {
        return 'C0123'
      }
      client.getClient = async authToken => {
        observedAuth = authToken
        return {
          customers: {
            enterprise: {
              securityInsights: {
                enable: async req => {
                  observedData = req.requestBody
                  return { data: { insightsState: 'INSIGHTS_ENABLED' } }
                },
              },
            },
          },
        }
      }
      const result = await client.enableSecurityInsights('my_customer', ['/corp'], 'TEST_BEARER_TOKEN')
      assert.strictEqual(observedAuth, 'TEST_BEARER_TOKEN')
      assert.deepStrictEqual(observedData, { targetOus: ['/corp'] })
      assert.deepStrictEqual(result, { insightsState: 'INSIGHTS_ENABLED' })
    })

    test('When disableSecurityInsights is called with an authToken, then it threads correctly', async () => {
      const { ChromeManagementClient } = await import('../../lib/api/chrome_management_client.js')
      const client = new ChromeManagementClient()
      let observedAuth = 'sentinel-not-set'
      client.resolveCustomerId = async (_customerId, _authToken) => {
        return 'C0123'
      }
      client.getClient = async authToken => {
        observedAuth = authToken
        return {
          customers: {
            enterprise: {
              securityInsights: {
                disable: async () => ({ data: { insightsState: 'INSIGHTS_DISABLED' } }),
              },
            },
          },
        }
      }
      const result = await client.disableSecurityInsights('my_customer', 'TEST_BEARER_TOKEN')
      assert.strictEqual(observedAuth, 'TEST_BEARER_TOKEN')
      assert.deepStrictEqual(result, { insightsState: 'INSIGHTS_DISABLED' })
    })

    test('When queryContentTransfers is called with options and authToken, then it threads correctly', async () => {
      const { ChromeManagementClient } = await import('../../lib/api/chrome_management_client.js')
      const client = new ChromeManagementClient()
      let observedAuth = 'sentinel-not-set'
      let observedParams = null
      let observedUrl = null
      client.resolveCustomerId = async (_customerId, _authToken) => {
        return 'C0123'
      }
      client.getClient = async authToken => {
        observedAuth = authToken
        return {
          context: {
            _options: {
              auth: {
                request: async req => {
                  observedParams = req.params
                  observedUrl = req.url
                  return { data: { summaries: [] } }
                },
              },
            },
          },
        }
      }
      const result = await client.queryContentTransfers(
        'my_customer',
        { filter: 'event_time >= "2024-01-01T00:00:00Z"' },
        'TEST_BEARER_TOKEN',
      )
      assert.strictEqual(observedAuth, 'TEST_BEARER_TOKEN')
      assert.ok(observedUrl.includes('v1alpha1/customers/C0123/enterprise/securityInsights:queryContentTransfers'))
      assert.deepStrictEqual(observedParams, { filter: 'event_time >= "2024-01-01T00:00:00Z"' })
      assert.deepStrictEqual(result, { summaries: [] })
    })

    test('When queryContentTransfersBreakdowns is called with options and authToken, then it threads correctly', async () => {
      const { ChromeManagementClient } = await import('../../lib/api/chrome_management_client.js')
      const client = new ChromeManagementClient()
      let observedAuth = 'sentinel-not-set'
      let observedParams = null
      let observedUrl = null
      client.resolveCustomerId = async (_customerId, _authToken) => {
        return 'C0123'
      }
      client.getClient = async authToken => {
        observedAuth = authToken
        return {
          context: {
            _options: {
              auth: {
                request: async req => {
                  observedParams = req.params
                  observedUrl = req.url
                  return { data: { contentTransfersBreakdowns: [], nextPageToken: 'next' } }
                },
              },
            },
          },
        }
      }
      const result = await client.queryContentTransfersBreakdowns('my_customer', { pageSize: 10 }, 'TEST_BEARER_TOKEN')
      assert.strictEqual(observedAuth, 'TEST_BEARER_TOKEN')
      assert.ok(
        observedUrl.includes('v1alpha1/customers/C0123/enterprise/securityInsights:queryContentTransfersBreakdowns'),
      )
      assert.deepStrictEqual(observedParams, { pageSize: 10 })
      assert.deepStrictEqual(result, { contentTransfersBreakdowns: [], nextPageToken: 'next' })
    })

    test('When queryUrlVisits is called with options and authToken, then it threads correctly', async () => {
      const { ChromeManagementClient } = await import('../../lib/api/chrome_management_client.js')
      const client = new ChromeManagementClient()
      let observedAuth = 'sentinel-not-set'
      let observedParams = null
      let observedUrl = null
      client.resolveCustomerId = async (_customerId, _authToken) => {
        return 'C0123'
      }
      client.getClient = async authToken => {
        observedAuth = authToken
        return {
          context: {
            _options: {
              auth: {
                request: async req => {
                  observedParams = req.params
                  observedUrl = req.url
                  return { data: { summaries: [] } }
                },
              },
            },
          },
        }
      }
      const result = await client.queryUrlVisits(
        'my_customer',
        { filter: 'event_time >= "2024-01-01T00:00:00Z"' },
        'TEST_BEARER_TOKEN',
      )
      assert.strictEqual(observedAuth, 'TEST_BEARER_TOKEN')
      assert.ok(observedUrl.includes('v1alpha1/customers/C0123/enterprise/securityInsights:queryUrlVisits'))
      assert.deepStrictEqual(observedParams, { filter: 'event_time >= "2024-01-01T00:00:00Z"' })
      assert.deepStrictEqual(result, { summaries: [] })
    })

    test('When queryUrlVisitsBreakdowns is called with options and authToken, then it threads correctly', async () => {
      const { ChromeManagementClient } = await import('../../lib/api/chrome_management_client.js')
      const client = new ChromeManagementClient()
      let observedAuth = 'sentinel-not-set'
      let observedParams = null
      let observedUrl = null
      client.resolveCustomerId = async (_customerId, _authToken) => {
        return 'C0123'
      }
      client.getClient = async authToken => {
        observedAuth = authToken
        return {
          context: {
            _options: {
              auth: {
                request: async req => {
                  observedParams = req.params
                  observedUrl = req.url
                  return { data: { urlVisitsBreakdowns: [], nextPageToken: 'next' } }
                },
              },
            },
          },
        }
      }
      const result = await client.queryUrlVisitsBreakdowns('my_customer', { pageSize: 10 }, 'TEST_BEARER_TOKEN')
      assert.strictEqual(observedAuth, 'TEST_BEARER_TOKEN')
      assert.ok(observedUrl.includes('v1alpha1/customers/C0123/enterprise/securityInsights:queryUrlVisitsBreakdowns'))
      assert.deepStrictEqual(observedParams, { pageSize: 10 })
      assert.deepStrictEqual(result, { urlVisitsBreakdowns: [], nextPageToken: 'next' })
    })
  })

  describe('security_insights Tool', () => {
    test('When action is check, then it calls checkSecurityInsightsStatus and returns formatted status', async () => {
      const mockCheck = mock.fn(async () => ({ insightsState: 'INSIGHTS_DISABLED' }))
      const MockChromeManagementClient = class {
        constructor() {
          this.checkSecurityInsightsStatus = mockCheck
        }
      }

      const { registerTools } = await esmock(
        '../../tools/index.js',
        {},
        {
          '../../lib/api/chrome_management_client.js': {
            ChromeManagementClient: MockChromeManagementClient,
          },
        },
      )
      registerTools(server, {
        apiClients: { chromeManagement: new MockChromeManagementClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'security_insights')
        .arguments[2]

      const result = await handler({ action: 'check', customerId: 'my_customer' }, {})

      assert.strictEqual(mockCheck.mock.callCount(), 1)
      assert.strictEqual(mockCheck.mock.calls[0].arguments[0], 'my_customer')
      assert.ok(result.content[0].text.includes('Chrome Security Insights status is: `INSIGHTS_DISABLED`'))
      assert.strictEqual(result.structuredContent.insightsState, 'INSIGHTS_DISABLED')
    })

    test('When action is enable with targetOus, then it calls enableSecurityInsights and returns status', async () => {
      const mockEnable = mock.fn(async () => ({ insightsState: 'INSIGHTS_ENABLED' }))
      const MockChromeManagementClient = class {
        constructor() {
          this.enableSecurityInsights = mockEnable
        }
      }

      const { registerTools } = await esmock(
        '../../tools/index.js',
        {},
        {
          '../../lib/api/chrome_management_client.js': {
            ChromeManagementClient: MockChromeManagementClient,
          },
        },
      )
      registerTools(server, {
        apiClients: { chromeManagement: new MockChromeManagementClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'security_insights')
        .arguments[2]

      const result = await handler({ action: 'enable', targetOus: ['/corp'], customerId: 'my_customer' }, {})

      assert.strictEqual(mockEnable.mock.callCount(), 1)
      assert.strictEqual(mockEnable.mock.calls[0].arguments[0], 'my_customer')
      assert.deepStrictEqual(mockEnable.mock.calls[0].arguments[1], ['/corp'])
      assert.ok(result.content[0].text.includes('status is now: `INSIGHTS_ENABLED`'))
    })

    test('When action is disable, then it calls disableSecurityInsights and returns status', async () => {
      const mockDisable = mock.fn(async () => ({ insightsState: 'INSIGHTS_DISABLED' }))
      const MockChromeManagementClient = class {
        constructor() {
          this.disableSecurityInsights = mockDisable
        }
      }

      const { registerTools } = await esmock(
        '../../tools/index.js',
        {},
        {
          '../../lib/api/chrome_management_client.js': {
            ChromeManagementClient: MockChromeManagementClient,
          },
        },
      )
      registerTools(server, {
        apiClients: { chromeManagement: new MockChromeManagementClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'security_insights')
        .arguments[2]

      const result = await handler({ action: 'disable', customerId: 'my_customer' }, {})

      assert.strictEqual(mockDisable.mock.callCount(), 1)
      assert.ok(result.content[0].text.includes('status is now: `INSIGHTS_DISABLED`'))
    })
  })
})
