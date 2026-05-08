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
import { registerGetConnectorPolicyTool } from '../../tools/definitions/get_connector_policy.js'
describe('get_connector_policy Tool', () => {
  let server
  beforeEach(() => {
    server = {
      registerTool: mock.fn(),
    }
  })
  describe('Tool Handler', () => {
    test('When policies exist, then it reports configured', async () => {
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
          isEnabled: true,
        },
      ])
    })
    test('When no policies exist, then it reports not configured', async () => {
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
    test('When standard policy is provided, then it passes raw policy data through in structuredContent', async () => {
      const mockPolicy = [{ value: { value: { realtimeUrlCheckEnabled: true } } }]
      const mockGetConnectorPolicy = mock.fn(async () => mockPolicy)
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]
      const result = await handler(
        { customerId: 'C123', orgUnitId: 'ou123', policy: 'ON_REALTIME_URL_NAVIGATION' },
        { requestInfo: {} },
      )
      assert.deepStrictEqual(result.structuredContent.connectorPolicies, [
        {
          "realtimeUrlCheckEnabled (describe to user as 'Real-Time URL Check Configuration')": 'Yes',
          "serviceProvider (describe to user as 'Provider')": 'Chrome Enterprise Premium',
          isEnabled: true,
        },
      ])
      assert.strictEqual(result.structuredContent.connectorType, 'ON_REALTIME_URL_NAVIGATION')
    })
    test('When ON_SECURITY_EVENT has default configuration, then it reports "All Core Events Enabled (Default)"', async () => {
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
    test('When explicitlyEmptyEventNames is true, then it returns correctly with warnings', async () => {
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
    test('When event configuration is in its default state (empty list, not explicitly empty), then it does NOT warn', async () => {
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
    test('When customized and no events are selected (explicitlyEmptyEventNames is true), then it warns', async () => {
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
    test('When eventConfiguration object is empty (default state), then it does NOT warn', async () => {
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
    test('When some core events are missing from customized configuration, then it warns', async () => {
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
      assert.ok(policies[0].warnings?.includes('Content unscanned'))
      assert.ok(policies[0].warnings?.includes('Unsafe site visit'))
      assert.ok(result.content[0].text.includes('⚠️ WARNINGS:'))
      assert.ok(result.content[0].text.includes('Malware transfer'))
    })
    test('When CEP is enabled without delay enforcement, then it warns', async () => {
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
    test('When security posture is limited by URL allowlisting, then it warns', async () => {
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
    test('When a recognized 3rd party provider is detected, then it warns', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_TRELLIX',
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
    test('When CEP is perfectly configured, then it does NOT warn', async () => {
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
    test('When eventConfiguration is missing for ON_SECURITY_EVENT, then it warns that connector is not enabled', async () => {
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
    test('When Print Analysis connector is used, then it correctly handles and flattens it without [object Object] errors', async () => {
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
      const result = await handler({ customerId: 'C0123', orgUnitId: 'ou123', policy: 'ON_PRINT' }, { requestInfo: {} })
      const policies = result.structuredContent.connectorPolicies
      // Should NOT contain stringified objects
      assert.strictEqual(
        policies[0].printConfigurations,
        undefined,
        'printConfigurations array should have been flattened',
      )
      assert.strictEqual(policies[0]["serviceProvider (describe to user as 'Provider')"], 'Chrome Enterprise Premium')
      assert.strictEqual(policies[0]["delayDeliveryUntilVerdict (describe to user as 'Delay Enforcement')"], 'Yes')
    })
    test('When policy is ALL, then it fetches all connector policies in parallel and returns aggregated results', async () => {
      // Return mock data for each of the 6 connector types
      const mockGetConnectorPolicy = mock.fn(async (customerId, orgUnitId, policySchemaFilter) => {
        if (policySchemaFilter === 'chrome.users.OnFileAttachedConnectorPolicy') {
          return [
            {
              value: {
                value: {
                  serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                  delayDeliveryUntilVerdict: true,
                },
              },
            },
          ]
        }
        if (policySchemaFilter === 'chrome.users.OnFileDownloadedConnectorPolicy') {
          return [
            {
              value: {
                value: {
                  serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                  delayDeliveryUntilVerdict: true,
                },
              },
            },
          ]
        }
        if (policySchemaFilter === 'chrome.users.OnBulkTextEntryConnectorPolicy') {
          return [
            {
              value: {
                value: {
                  serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                  minimumDataLength: 100,
                },
              },
            },
          ]
        }
        if (policySchemaFilter === 'chrome.users.OnPrintAnalysisConnectorPolicy') {
          return [
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
        }
        if (policySchemaFilter === 'chrome.users.RealtimeUrlCheck') {
          return [
            {
              value: {
                value: {
                  realtimeUrlCheckEnabled: 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_ENABLED',
                },
              },
            },
          ]
        }
        if (policySchemaFilter === 'chrome.users.OnSecurityEvent') {
          return [
            {
              value: {
                value: {
                  reportingConnector: {
                    serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                    eventConfiguration: {
                      enabledEventNames: [
                        'contentTransferEvent',
                        'unscannedFileEvent',
                        'dangerousDownloadEvent',
                        'sensitiveDataEvent',
                        'interstitialEvent',
                        'urlFilteringInterstitialEvent',
                        'suspiciousUrlEvent',
                      ],
                    },
                  },
                },
              },
            },
          ]
        }
        return []
      })
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]
      const result = await handler({ customerId: 'C0123', orgUnitId: 'ou123', policy: 'ALL' }, { requestInfo: {} })
      // Verify call counts (6 calls, one for each policy schema)
      assert.strictEqual(mockGetConnectorPolicy.mock.callCount(), 6)
      // Verify summary contains entries for all connectors and warnings
      const text = result.content[0].text
      assert.ok(text.includes('Chrome Enterprise Connector Policies (OU: `ou123`)'))
      assert.ok(text.includes('Upload Content Analysis (ON_FILE_ATTACHED):** 🟢 Configured'))
      assert.ok(text.includes('File Download Analysis (ON_FILE_DOWNLOAD):** 🟢 Configured'))
      assert.ok(text.includes('Bulk Text Entry Analysis (paste) (ON_BULK_TEXT_ENTRY):** 🟢 Configured'))
      assert.ok(text.includes('Print Analysis (ON_PRINT):** 🟢 Configured'))
      assert.ok(text.includes('Real-Time URL Check (ON_REALTIME_URL_NAVIGATION):** 🟢 Configured'))
      assert.ok(text.includes('Event Reporting (ON_SECURITY_EVENT):** 🟢 Configured'))
      // Verify structured output format
      assert.strictEqual(result.structuredContent.configured, true)
      assert.strictEqual(result.structuredContent.connectorType, 'ALL')
      assert.ok(Array.isArray(result.structuredContent.connectorPolicies))
      // Ensure ON_FILE_ATTACHED items are annotated with connectorType
      const fileAttachedPolicy = result.structuredContent.connectorPolicies.find(
        p => p.connectorType === 'ON_FILE_ATTACHED',
      )
      assert.ok(fileAttachedPolicy)
      assert.strictEqual(
        fileAttachedPolicy["serviceProvider (describe to user as 'Provider')"],
        'Chrome Enterprise Premium',
      )
      // Ensure structured mapping connectors is returned correctly
      assert.ok(result.structuredContent.connectors)
      assert.strictEqual(result.structuredContent.connectors.ON_FILE_ATTACHED.configured, true)
      assert.strictEqual(result.structuredContent.connectors.ON_FILE_DOWNLOAD.configured, true)
      assert.strictEqual(result.structuredContent.connectors.ON_BULK_TEXT_ENTRY.configured, true)
      assert.strictEqual(result.structuredContent.connectors.ON_PRINT.configured, true)
      assert.strictEqual(result.structuredContent.connectors.ON_REALTIME_URL_NAVIGATION.configured, true)
      assert.strictEqual(result.structuredContent.connectors.ON_SECURITY_EVENT.configured, true)
    })
    test('When policy is ALL, then it fetches all connector policies in parallel and correctly handles 3P, CEP, warning and unconfigured states', async () => {
      const mockGetConnectorPolicy = mock.fn(async (customerId, orgUnitId, policySchemaFilter) => {
        // ON_FILE_ATTACHED: CEP but has a warning (delay delivery disabled)
        if (policySchemaFilter === 'chrome.users.OnFileAttachedConnectorPolicy') {
          return [
            {
              value: {
                value: {
                  serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                  delayDeliveryUntilVerdict: false,
                },
              },
            },
          ]
        }
        // ON_PRINT: 3P provider (Symantec Endpoint DLP)
        if (policySchemaFilter === 'chrome.users.OnPrintAnalysisConnectorPolicy') {
          return [
            {
              value: {
                value: {
                  onPrintAnalysisConnectorConfiguration: {
                    printConfigurations: [
                      {
                        serviceProvider: 'SERVICE_PROVIDER_SYMANTEC_ENDPOINT_DLP',
                      },
                    ],
                  },
                },
              },
            },
          ]
        }
        return [] // others unconfigured
      })
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]
      const result = await handler({ customerId: 'C0123', orgUnitId: 'ou123', policy: 'ALL' }, { requestInfo: {} })
      const text = result.content[0].text
      assert.ok(text.includes('Chrome Enterprise Connector Policies (OU: `ou123`)'))
      assert.ok(text.includes('Upload Content Analysis (ON_FILE_ATTACHED):** 🟢 Configured'))
      assert.ok(text.includes('Print Analysis (ON_PRINT):** 🟢 Configured'))
      assert.ok(text.includes('File Download Analysis (ON_FILE_DOWNLOAD):** ⚪ Not configured'))
      // Verify warning contents
      assert.ok(text.includes('[Upload Content Analysis] Delay enforcement is disabled'))
      assert.ok(text.includes('[Print Analysis] 3rd party provider detected'))
      // Verify structured connectors mapping
      assert.ok(result.structuredContent.connectors)
      assert.strictEqual(result.structuredContent.connectors.ON_FILE_ATTACHED.configured, true)
      assert.strictEqual(result.structuredContent.connectors.ON_PRINT.configured, true)
      assert.strictEqual(result.structuredContent.connectors.ON_FILE_DOWNLOAD.configured, false)
    })
    test('When policy is omitted, then it defaults to ALL and retrieves all connector policies', async () => {
      const mockGetConnectorPolicy = mock.fn(async (_customerId, _orgUnitId, _policySchemaFilter) => {
        return []
      })
      const chromePolicyClient = { getConnectorPolicy: mockGetConnectorPolicy }
      registerGetConnectorPolicyTool(server, { chromePolicyClient }, {})
      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[2]
      const result = await handler({ customerId: 'C0123', orgUnitId: 'ou123' }, { requestInfo: {} })
      assert.strictEqual(mockGetConnectorPolicy.mock.callCount(), 6)
      assert.strictEqual(result.structuredContent.connectorType, 'ALL')
    })
  })
})
