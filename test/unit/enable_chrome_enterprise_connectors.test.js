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

/**
 * Unit Tests for the Enable Chrome Enterprise Connectors Tool.
 * Verifies the logic of safety checks and batching using a mocked client.
 */
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

  test('should enable connectors when none are configured', async () => {
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
    assert.match(result.content[0].text, /Bulk Text Entry \(Paste\) marked for enablement/)
  })

  test('should skip connectors that are already configured', async () => {
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

  test('should handle mix of configured and unconfigured connectors', async () => {
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
    assert.match(result.content[0].text, /Bulk Text Entry \(Paste\) marked for enablement/)
  })
})
