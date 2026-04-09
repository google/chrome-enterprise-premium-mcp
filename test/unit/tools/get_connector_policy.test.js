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

  test('should report CEP or None for ON_REALTIME_URL_NAVIGATION', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async (customerId, orgUnitId, policy) => {
        if (policy === 'chrome.users.RealtimeUrlCheck') {
          return [
            {
              value: {
                value: {
                  realtimeUrlCheckEnabled: 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_ENABLED',
                },
              },
            },
            {
              value: {
                value: {
                  realtimeUrlCheckEnabled: true,
                },
              },
            },
            {
              value: {
                value: {
                  realtimeUrlCheckEnabled: false,
                },
              },
            },
          ]
        }
        return []
      },
    }

    registerGetConnectorPolicyTool(mockServer, { chromePolicyClient: mockChromePolicyClient }, {})
    const handler = getRegisteredHandler()

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_REALTIME_URL_NAVIGATION' },
      { requestInfo: {} },
    )
    const text = result.content[0].text

    assert.match(text, /Status: Chrome Enterprise Premium \(CEP\)/)
    assert.match(text, /Status: None/)
  })

  test('should format multiple policies in a single response', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          targetKey: { targetResource: 'orgunits/OU1' },
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: true,
            },
          },
        },
        {
          targetKey: { targetResource: 'orgunits/OU2' },
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_OTHER',
              delayDeliveryUntilVerdict: false,
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

    // Check that both OU configurations are in the summary
    assert.match(text, /Provider: Chrome Enterprise Premium \(CEP\)/)
    assert.match(text, /Provider: Service Provider Other/)
    assert.match(text, /Delay Enforcement: Enabled/)
    assert.match(text, /Delay Enforcement: Disabled/)
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

  test('should parse ON_SECURITY_EVENT specific fields with setting structure', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              reportingConnector: {
                setting: {
                  eventConfiguration: {
                    enabledEventNames: ['contentTransferEvent', 'dangerousDownloadEvent'],
                  },
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

    assert.match(text, /Reported Events: Content transfer, Malware transfer/)
  })

  test('should format multiple ON_SECURITY_EVENT policies in a single response', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          targetKey: { targetResource: 'orgunits/OU_ENABLED' },
          value: {
            value: {
              reportingConnector: {
                setting: {
                  eventConfiguration: {
                    enabledEventNames: ['malwareEvent'],
                  },
                },
              },
            },
          },
        },
        {
          targetKey: { targetResource: 'orgunits/OU_DISABLED' },
          value: {
            value: {
              reportingConnector: {},
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

    assert.match(text, /Reported Events: malwareEvent/)
    assert.match(text, /Reported Events: Disabled/)
  })

  test('should parse ON_SECURITY_EVENT with snake_case internal fields', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              reporting_connector: {
                setting: {
                  event_configuration: {
                    enabled_event_names: ['snakeEvent1', 'snakeEvent2'],
                  },
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

    assert.match(text, /Reported Events: snakeEvent1, snakeEvent2/)
  })

  test('should report Disabled for ON_SECURITY_EVENT when eventConfiguration is missing', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              reportingConnector: {
                setting: {},
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

    assert.match(text, /Reported Events: Disabled/)
  })

  test('should report Disabled for ON_SECURITY_EVENT when reportingConnector is empty', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              reportingConnector: {},
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

    assert.match(text, /Reported Events: Disabled/)
  })

  test('should report default core events for ON_SECURITY_EVENT when empty and not explicitlyEmptyEventNames', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              reportingConnector: {
                setting: {
                  eventConfiguration: {
                    enabledEventNames: [],
                    explicitlyEmptyEventNames: false,
                  },
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

    assert.match(text, /Reported Events: Default \(Core Events Enabled\)/)
  })

  test('should report None for ON_SECURITY_EVENT when explicitlyEmptyEventNames is true', async () => {
    const { mockServer, getRegisteredHandler } = getHandler()
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              reportingConnector: {
                setting: {
                  eventConfiguration: {
                    enabledEventNames: [],
                    explicitlyEmptyEventNames: true,
                  },
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

    assert.match(text, /Reported Events: None/)
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
