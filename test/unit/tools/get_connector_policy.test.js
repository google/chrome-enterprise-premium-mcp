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
import { registerGetConnectorPolicyTool } from '../../../tools/definitions/get_connector_policy.js'

describe('get_connector_policy tool handler', () => {
  const getHandler = () => {
    let registeredHandler
    const mockServer = {
      registerTool(name, config, handler) {
        if (name === 'get_connector_policy') {
          registeredHandler = handler
        }
      },
    }
    return { mockServer, getRegisteredHandler: () => registeredHandler }
  }

  test('should parse standard camelCase keys', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: true,
              blockFileOnContentAnalysisFailure: true,
            },
          },
        },
      ],
    }

    registerGetConnectorPolicyTool(mockServer, { chromePolicyClient: mockChromePolicyClient }, {})
    const handler = getRegisteredHandler()

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const text = result.content[0].text

    assert.match(text, /Provider: Chrome Enterprise Premium \(CEP\)/)
    assert.match(text, /Delay Enforcement: Enabled/)
    assert.match(text, /Block on Failure: Enabled/)
  })

  test('should parse snake_case keys (standard API wire format)', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              service_provider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delay_delivery_until_verdict: true,
              block_file_on_content_analysis_failure: true,
            },
          },
        },
      ],
    }

    registerGetConnectorPolicyTool(mockServer, { chromePolicyClient: mockChromePolicyClient }, {})
    const handler = getRegisteredHandler()

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const text = result.content[0].text

    assert.match(text, /Provider: Chrome Enterprise Premium \(CEP\)/)
    assert.match(text, /Delay Enforcement: Enabled/)
    assert.match(text, /Block on Failure: Enabled/)
  })

  test('should fall back to block_until_verdict for blockOnFail', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              service_provider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              block_until_verdict: true,
            },
          },
        },
      ],
    }

    registerGetConnectorPolicyTool(mockServer, { chromePolicyClient: mockChromePolicyClient }, {})
    const handler = getRegisteredHandler()

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const text = result.content[0].text

    assert.match(text, /Block on Failure: Enabled/)
  })

  test('should parse stringified JSON', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: JSON.stringify({
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: true,
              blockFileOnContentAnalysisFailure: true,
            }),
          },
        },
      ],
    }

    registerGetConnectorPolicyTool(mockServer, { chromePolicyClient: mockChromePolicyClient }, {})
    const handler = getRegisteredHandler()

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const text = result.content[0].text

    assert.match(text, /Provider: Chrome Enterprise Premium \(CEP\)/)
  })

  test('should dump raw data for unexpected shapes', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: 'Just some text that is not JSON',
          },
        },
      ],
    }

    registerGetConnectorPolicyTool(mockServer, { chromePolicyClient: mockChromePolicyClient }, {})
    const handler = getRegisteredHandler()

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const text = result.content[0].text

    assert.match(text, /Raw Value: "Just some text that is not JSON"/)
  })

  test('should parse ON_SECURITY_EVENT specific fields', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              reportingConnector: {
                eventConfiguration: {
                  enabledEventNames: ['contentTransferEvent', 'dangerousDownloadEvent'],
                },
              },
            },
          },
        },
      ],
    }

    registerGetConnectorPolicyTool(mockServer, { chromePolicyClient: mockChromePolicyClient }, {})
    const handler = getRegisteredHandler()

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_SECURITY_EVENT' },
      { requestInfo: {} },
    )
    const text = result.content[0].text

    assert.match(text, /Reported Events: contentTransferEvent, dangerousDownloadEvent/)
  })

  test('should unpack deeply nested single-key configuration', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              onFileAttachedAnalysisConnectorConfiguration: {
                fileAttachedConfiguration: {
                  serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                  delayDeliveryUntilVerdict: true,
                  blockFileOnContentAnalysisFailure: true,
                },
              },
            },
          },
        },
      ],
    }

    registerGetConnectorPolicyTool(mockServer, { chromePolicyClient: mockChromePolicyClient }, {})
    const handler = getRegisteredHandler()

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const text = result.content[0].text

    assert.match(text, /Provider: Chrome Enterprise Premium \(CEP\)/)
    assert.match(text, /Delay Enforcement: Enabled/)
    assert.match(text, /Block on Failure: Enabled/)
  })
})
