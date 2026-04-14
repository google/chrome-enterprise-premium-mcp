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
import { registerGetConnectorPolicyTool } from '../../tools/definitions/get_connector_policy.js'

describe('get_connector_policy Tool', () => {
  let server

  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }
  })

  describe('Tool Handler', () => {
    it('should report configured when policies exist', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              onFileDownloadedAnalysisConnectorConfiguration: {
                fileDownloadedConfiguration: {
                  serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                  delayDeliveryUntilVerdict: true,
                },
              },
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_FILE_DOWNLOAD' },
        { requestInfo: {} },
      )

      assert.ok(result.content[0].text.includes('Configured'))
      assert.strictEqual(result.structuredContent.configured, true)
      assert.deepStrictEqual(result.structuredContent.connectorPolicies, [
        {
          "delayDeliveryUntilVerdict (describe to user as 'Delay Enforcement')": 'Yes',
          "serviceProvider (describe to user as 'Provider')": 'Chrome Enterprise Premium',
        },
      ])
    })

    it('should report not configured when no policies exist', async () => {
      const mockGetConnectorPolicy = mock.fn(async () => [])
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_FILE_DOWNLOAD' },
        { requestInfo: {} },
      )

      assert.ok(result.content[0].text.includes('Not configured'))
      assert.strictEqual(result.structuredContent.configured, false)
    })

    it('should pass raw policy data through in structuredContent', async () => {
      const mockPolicy = [{ value: { value: { realtimeUrlCheckEnabled: true } } }]
      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_REALTIME_URL_NAVIGATION' },
        { requestInfo: {} },
      )

      assert.deepStrictEqual(result.structuredContent.connectorPolicies, [
        { "realtimeUrlCheckEnabled (describe to user as 'Real-Time URL Check Configuration')": 'Yes' },
      ])
      assert.strictEqual(result.structuredContent.connectorType, 'ON_REALTIME_URL_NAVIGATION')
    })

    it('should report "All Core Events Enabled (Default)" for ON_SECURITY_EVENT when default', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {
                  enabledEventNames: [],
                  explicitlyEmptyEventNames: false,
                },
              },
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      const state = {}

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, state)
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_SECURITY_EVENT' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.strictEqual(policies[0]['Reporting Status'], 'All Core Events Enabled (Default)')
      assert.ok(result.content[0].text.includes('Configured'))
    })

    it('should return correctly when explicitlyEmptyEventNames is true', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {
                  explicitlyEmptyEventNames: true,
                },
              },
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      const state = {}

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, state)
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_SECURITY_EVENT' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.ok(policies[0].warnings?.includes('Missing core DLP events'))
      assert.ok(result.content[0].text.includes('⚠️ WARNINGS:'))
      assert.ok(result.content[0].text.includes('Missing core DLP events'))
    })

    it('should NOT warn when event configuration is in its default state (empty list, not explicitly empty)', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {
                  enabledEventNames: [],
                  explicitlyEmptyEventNames: false,
                },
              },
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      const state = {}

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, state)
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_SECURITY_EVENT' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.strictEqual(policies[0].warnings, undefined, 'Should NOT have warnings for default event state')
    })

    it('should warn when customized and no events are selected (explicitlyEmptyEventNames is true)', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {
                  enabledEventNames: [],
                  explicitlyEmptyEventNames: true,
                },
              },
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      const state = {}

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, state)
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_SECURITY_EVENT' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.ok(policies[0].warnings?.includes('Missing core DLP events'))
      assert.ok(result.content[0].text.includes('⚠️ WARNINGS:'))
      assert.ok(result.content[0].text.includes('Missing core DLP events'))
    })

    it('should NOT warn when eventConfiguration object is empty (default state)', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {},
              },
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      const state = {}

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, state)
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_SECURITY_EVENT' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.strictEqual(policies[0].warnings, undefined, 'Empty eventConfiguration should be treated as default')
    })

    it('should warn when some core events are missing from customized configuration', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {
                  enabledEventNames: [
                    'browserCrashEvent',
                    'contentTransferEvent',
                    'sensitiveDataEvent',
                    'urlFilteringInterstitialEvent',
                  ],
                },
              },
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      const state = {}

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, state)
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_SECURITY_EVENT' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.ok(policies[0].warnings?.includes('Malware transfer'))
      assert.ok(policies[0].warnings?.includes('Suspicious URL'))
      assert.ok(result.content[0].text.includes('⚠️ WARNINGS:'))
      assert.ok(result.content[0].text.includes('Malware transfer'))
    })

    it('should warn when CEP is enabled without delay enforcement', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: false,
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_FILE_ATTACHED' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.ok(policies[0].warnings?.includes('Delay enforcement is disabled'))
      assert.ok(result.content[0].text.includes('⚠️ WARNINGS:'))
      assert.ok(result.content[0].text.includes('Delay enforcement is disabled'))
    })

    it('should warn when security posture is limited by URL allowlisting', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: true,
              malwareUrlPatterns: ['example.com'],
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_FILE_ATTACHED' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.ok(policies[0].warnings?.includes('limited due to URL allowlisting'))
      assert.ok(result.content[0].text.includes('⚠️ WARNINGS:'))
      assert.ok(result.content[0].text.includes('limited due to URL allowlisting'))
    })

    it('should warn when a 3rd party provider is detected', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_OTHER',
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_FILE_ATTACHED' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.ok(policies[0].warnings?.includes('3rd party provider detected'))
      assert.ok(result.content[0].text.includes('⚠️ WARNINGS:'))
      assert.ok(result.content[0].text.includes('3rd party provider detected'))
    })

    it('should NOT warn when CEP is perfectly configured', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: true,
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_FILE_ATTACHED' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.ok(!policies[0].warnings)
    })

    it('should warn that connector is not enabled when eventConfiguration is missing', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              reportingConnector: {},
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      const state = {}

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, state)
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_SECURITY_EVENT' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      assert.ok(policies[0].warnings?.includes('Connector is not enabled'))
    })

    it('should correctly handle and flatten the Print Analysis connector without [object Object] errors', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              onPrintAnalysisConnectorConfiguration: {
                printConfigurations: [
                  {
                    serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                    delayDeliveryUntilVerdict: true,
                  },
                ],
              },
            },
          },
        },
      ]

      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }

      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]

      const result = await handler(
        { customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_PRINT' },
        { requestInfo: {} },
      )

      const policies = result.structuredContent.connectorPolicies
      // Should NOT contain stringified objects
      assert.strictEqual(policies[0].printConfigurations, undefined, 'printConfigurations array should have been flattened')
      assert.strictEqual(
        policies[0]["serviceProvider (describe to user as 'Provider')"],
        'Chrome Enterprise Premium',
      )
      assert.strictEqual(policies[0]["delayDeliveryUntilVerdict (describe to user as 'Delay Enforcement')"], 'Yes')
    })
  })
})
