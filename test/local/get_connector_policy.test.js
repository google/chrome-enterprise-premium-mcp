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

  describe('Tool Registration (Description)', () => {
    it('should have a concise description', async () => {
      const chromePolicyClient = {}
      const state = {}
      registerGetConnectorPolicyTool(server, { chromePolicyClient }, state)

      const toolDefinition = server.registerTool.mock.calls.find(call => call.arguments[0] === 'get_connector_policy')
        .arguments[1]

      assert.strictEqual(
        toolDefinition.description,
        `Retrieves the current configuration for a specific Chrome Enterprise connector.\nUse this to AUDIT or VERIFY settings for features like "printing sensitive data", "real-time URL checks", or "event reporting". \n\nRecommended Flow: Use this tool to retrieve technical settings, then use a knowledge base search to verify the documented meaning and troubleshooting steps for those settings.\n\nTo modify these settings, use 'enable_chrome_enterprise_connectors'.`,
      )
    })
  })

  describe('Tool Handler', () => {
    it('should return correctly for explicitly enabled core events', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {
                  enabledEventNames: [
                    'contentTransferEvent',
                    'dangerousDownloadEvent',
                    'sensitiveDataEvent',
                    'urlFilteringInterstitialEvent',
                    'suspiciousUrlEvent',
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

      assert.ok(result.content[0].text.includes('Content transfer'))
      assert.ok(result.content[0].text.includes('Suspicious URL'))
      assert.ok(!result.content[0].text.includes('⚠️ WARNING'))
      assert.deepStrictEqual(result.structuredContent.connectorPolicies, mockPolicy)
    })

    it('should return "Default (Core Events Enabled)" for empty configuration when explicitlyEmptyEventNames is not true', async () => {
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

      assert.ok(result.content[0].text.includes('**Reported Events**: Default (Core Events Enabled)'))
      assert.ok(!result.content[0].text.includes('WARNING'))
      assert.deepStrictEqual(result.structuredContent.connectorPolicies, mockPolicy)
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

      assert.ok(result.content[0].text.includes('**Reported Events**: None'))
      assert.ok(
        result.content[0].text.includes(
          'WARNING: The following core DLP events are missing from your customized configuration: Content transfer, Malware transfer, Sensitive data transfer, URL filtering interstitial, Suspicious URL',
        ),
      )
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

      assert.ok(result.content[0].text.includes('Content transfer'))
      assert.ok(
        result.content[0].text.includes(
          'WARNING: The following core DLP events are missing from your customized configuration: Malware transfer, Suspicious URL',
        ),
      )
    })

    it('should warn when all core events are missing from customized configuration', async () => {
      const mockPolicy = [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {
                  enabledEventNames: ['browserCrashEvent'],
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

      assert.ok(result.content[0].text.includes('Browser crash'))
      assert.ok(
        result.content[0].text.includes(
          'WARNING: The following core DLP events are missing from your customized configuration: Content transfer, Malware transfer, Sensitive data transfer, URL filtering interstitial, Suspicious URL',
        ),
      )
    })

    it('should show "Disabled" when eventConfiguration is missing', async () => {
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

      assert.ok(result.content[0].text.includes('**Reported Events**: Disabled'))
    })
  })
})
