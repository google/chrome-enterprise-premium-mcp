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
import { registerEnableChromeEnterpriseConnectorsTool } from '../../tools/definitions/enable_chrome_enterprise_connectors.js'

describe('enable_chrome_enterprise_connectors unit tests', () => {
  // Mock MCP Server
  const mockServer = {
    registerTool: (name, schema, handler) => {
      mockServer.registeredHandler = handler
    },
  }

  // Mock Chrome Policy Client
  class MockChromePolicyClient {
    constructor() {
      this.resolvePolicyCalls = []
      this.batchModifyPolicyCalls = []
      this.resolveResponse = []
    }

    async resolvePolicy(customerId, orgUnitId, schema) {
      this.resolvePolicyCalls.push({ customerId, orgUnitId, schema })
      return this.resolveResponse
    }

    async batchModifyPolicy(customerId, orgUnitId, requests) {
      this.batchModifyPolicyCalls.push({ customerId, orgUnitId, requests })
      return {}
    }
  }

  const setupTool = () => {
    const client = new MockChromePolicyClient()
    registerEnableChromeEnterpriseConnectorsTool(mockServer, { chromePolicyClient: client }, {})
    return { client, handler: mockServer.registeredHandler }
  }

  test('should enable connectors when none are configured', { skip: true }, async () => {
    const { client, handler } = setupTool()
    client.resolveResponse = [] // Simulate "None"

    const params = {
      customerId: 'C123',
      orgUnitId: 'OU456',
      connectors: ['PRINT', 'BULK_TEXT_ENTRY'],
    }

    const result = await handler(params, {})

    assert.strictEqual(client.resolvePolicyCalls.length, 2)
    assert.strictEqual(client.batchModifyPolicyCalls.length, 1)
    assert.strictEqual(client.batchModifyPolicyCalls[0].requests.length, 2)
    assert.match(result.content[0].text, /Print Analysis marked for enablement/)
    assert.match(result.content[0].text, /Bulk Text Entry Analysis \(paste\) marked for enablement/)
  })

  test('should skip connectors that are already configured', { skip: true }, async () => {
    const { client, handler } = setupTool()

    // Simulate already configured for Print
    client.resolveResponse = [
      {
        value: {
          value: {
            onPrintAnalysisConnectorConfiguration: {
              printConfigurations: [{ serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM' }],
            },
          },
        },
      },
    ]

    const params = {
      customerId: 'C123',
      orgUnitId: 'OU456',
      connectors: ['PRINT'],
    }

    const result = await handler(params, {})

    assert.strictEqual(client.resolvePolicyCalls.length, 1)
    assert.strictEqual(client.batchModifyPolicyCalls.length, 0) // No batch call
    assert.match(result.content[0].text, /Print Analysis is already configured. Skipping update/)
  })

  test('should handle mix of configured and unconfigured connectors', { skip: true }, async () => {
    const { client, handler } = setupTool()

    // Simple mock logic to vary response based on schema
    client.resolvePolicy = async (customerId, orgUnitId, schema) => {
      client.resolvePolicyCalls.push({ schema })
      if (schema === 'chrome.users.OnPrintAnalysisConnectorPolicy') {
        return [
          {
            value: {
              value: {
                onPrintAnalysisConnectorConfiguration: {
                  printConfigurations: [{ serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM' }],
                },
              },
            },
          },
        ]
      }
      return [] // Others are None
    }

    const params = {
      customerId: 'C123',
      orgUnitId: 'OU456',
      connectors: ['PRINT', 'BULK_TEXT_ENTRY'],
    }

    const result = await handler(params, {})

    assert.strictEqual(client.resolvePolicyCalls.length, 2)
    assert.strictEqual(client.batchModifyPolicyCalls.length, 1)
    assert.strictEqual(client.batchModifyPolicyCalls[0].requests.length, 1) // Only Bulk
    assert.match(result.content[0].text, /Print Analysis is already configured/)
    assert.match(result.content[0].text, /Bulk Text Entry Analysis \(paste\) marked for enablement/)
  })

  test('should enable ON_SECURITY_EVENT when not configured', { skip: true }, async () => {
    const { client, handler } = setupTool()
    client.resolveResponse = [] // Simulate "None"

    const params = {
      customerId: 'C123',
      orgUnitId: 'OU456',
      connectors: ['ON_SECURITY_EVENT'],
    }

    const result = await handler(params, {})

    assert.strictEqual(client.resolvePolicyCalls.length, 1)
    assert.strictEqual(client.resolvePolicyCalls[0].schema, 'chrome.users.OnSecurityEvent')
    assert.strictEqual(client.batchModifyPolicyCalls.length, 1)
    assert.strictEqual(
      client.batchModifyPolicyCalls[0].requests[0].policyValue.policySchema,
      'chrome.users.OnSecurityEvent',
    )
    assert.strictEqual(
      client.batchModifyPolicyCalls[0].requests[0].policyValue.value.reportingConnector.eventConfiguration
        .explicitlyEmptyEventNames,
      false,
    )
    assert.match(result.content[0].text, /Event Reporting marked for enablement/)
  })

  test('should skip ON_SECURITY_EVENT when already configured', { skip: true }, async () => {
    const { client, handler } = setupTool()

    client.resolveResponse = [
      {
        value: {
          value: {
            reportingConnector: {
              eventConfiguration: {
                explicitlyEmptyEventNames: false,
              },
            },
          },
        },
      },
    ]

    const params = {
      customerId: 'C123',
      orgUnitId: 'OU456',
      connectors: ['ON_SECURITY_EVENT'],
    }

    const result = await handler(params, {})

    assert.strictEqual(client.resolvePolicyCalls.length, 1)
    assert.strictEqual(client.batchModifyPolicyCalls.length, 0)
    assert.match(result.content[0].text, /Event Reporting is already configured. Skipping update/)
  })

  test(
    'should skip ON_SECURITY_EVENT when explicitlyEmptyEventNames is true and some events are present (Core events missing but configured)',
    { skip: true },
    async () => {
      const { client, handler } = setupTool()

      client.resolveResponse = [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {
                  enabledEventNames: ['browserCrashEvent', 'extensionInstallEvent'],
                  explicitlyEmptyEventNames: true,
                },
              },
            },
          },
        },
      ]

      const params = {
        customerId: 'C123',
        orgUnitId: 'OU456',
        connectors: ['ON_SECURITY_EVENT'],
      }

      const result = await handler(params, {})

      assert.strictEqual(client.resolvePolicyCalls.length, 1)
      assert.strictEqual(client.batchModifyPolicyCalls.length, 0)
      assert.match(result.content[0].text, /Event Reporting is already configured. Skipping update/)
    },
  )

  test('should skip ON_SECURITY_EVENT when perfectly customized with all 5 core events', { skip: true }, async () => {
    const { client, handler } = setupTool()

    client.resolveResponse = [
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
                explicitlyEmptyEventNames: false,
              },
            },
          },
        },
      },
    ]

    const params = {
      customerId: 'C123',
      orgUnitId: 'OU456',
      connectors: ['ON_SECURITY_EVENT'],
    }

    const result = await handler(params, {})

    assert.strictEqual(client.resolvePolicyCalls.length, 1)
    assert.strictEqual(client.batchModifyPolicyCalls.length, 0)
    assert.match(result.content[0].text, /Event Reporting is already configured. Skipping update/)
  })

  test('should normalize orgUnitId by removing id: prefix', async () => {
    const { client, handler } = setupTool()
    client.resolveResponse = []

    const params = {
      customerId: 'C123',
      orgUnitId: 'id:OU123',
      connectors: ['PRINT'],
    }

    await handler(params, {})

    assert.strictEqual(client.resolvePolicyCalls[0].orgUnitId, 'OU123')
    assert.strictEqual(client.batchModifyPolicyCalls[0].orgUnitId, 'OU123')
  })
})
