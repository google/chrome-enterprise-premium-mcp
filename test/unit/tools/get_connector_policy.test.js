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
  const getHandler = mockChromePolicyClient => {
    let registeredHandler
    const mockServer = {
      registerTool(name, config, handler) {
        if (name === 'get_connector_policy') {
          registeredHandler = handler
        }
      },
    }
    registerGetConnectorPolicyTool(mockServer, { chromePolicyClient: mockChromePolicyClient }, {})
    return registeredHandler
  }

  test('should parse standard camelCase keys', async () => {
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Configured/)
    assert.match(dataText, /Provider/)
    assert.match(dataText, /Chrome Enterprise Premium/)
    assert.match(dataText, /Delay Enforcement/)
    assert.match(dataText, /Yes/)
    assert.match(dataText, /Block on Failure/)
    assert.match(dataText, /Yes/)
    assert.match(dataText, /"isEnabled": true/)
    assert.strictEqual(result.structuredContent.configured, true)
  })

  test('should report "Not configured" when Real-time URL check is disabled', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async (customerId, orgUnitId, policy) => {
        if (policy === 'chrome.users.RealtimeUrlCheck') {
          return [
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_REALTIME_URL_NAVIGATION' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text
    const dataText = result.content[1].text

    // Verify accurate status reporting
    assert.match(summary, /^Connector policy: Real-Time URL Check \(OU: `OU123`\)\nStatus: Not configured$/)

    // Verify JSON details
    assert.match(dataText, /"isEnabled": false/)
    assert.match(dataText, /"realtimeUrlCheckEnabled \(describe to user as 'Real-Time URL Check Configuration'\)": "No"/)
    assert.strictEqual(result.structuredContent.configured, false)
  })

  test('should report "Configured" with warnings for sub-optimal CEP settings', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
              delayDeliveryUntilVerdict: false, // Sub-optimal
            },
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text
    const dataText = result.content[1].text

    // Verify Status is still Configured
    assert.match(summary, /Status: Configured/)

    // Verify Warning is present in Summary
    assert.match(summary, /⚠️ WARNINGS:/)
    assert.match(summary, /Delay enforcement is disabled/)
    assert.match(summary, /https:\/\/admin\.google\.com\/ac\/chrome\/settings\/user\/details\/file_attached/)

    // Verify JSON contains the same warning
    assert.match(dataText, /"isEnabled": true/)
    assert.match(dataText, /"warnings": ".*Delay enforcement is disabled.*"/)
  })

  test('should report "Configured" without 3rd party warnings for generic unknown providers', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_OTHER',
            },
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Configured/)
    assert.doesNotMatch(summary, /3rd party provider detected/)
    assert.match(dataText, /"isEnabled": true/)
    assert.doesNotMatch(dataText, /Integrated CEP features may be bypassed/)
  })

  test('should report "Configured" with warnings for Symantec/Trellix 3rd party providers', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_TRELLIX',
            },
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Configured/)
    assert.match(summary, /3rd party provider detected/)
    assert.match(dataText, /"isEnabled": true/)
    assert.match(dataText, /Integrated CEP features may be bypassed/)
  })

  test('should report "Not configured" when Analysis Provider is UNSPECIFIED', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_UNSPECIFIED',
            },
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Not configured/)
    assert.match(dataText, /Connector is not enabled/)
    assert.strictEqual(result.structuredContent.configured, false)
  })

  test('should report "Not configured" when Analysis Provider is NONE', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              serviceProvider: 'SERVICE_PROVIDER_NONE',
            },
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Not configured/)
    assert.match(dataText, /Connector is not enabled/)
    assert.strictEqual(result.structuredContent.configured, false)
  })

  test('should report "Not configured" when Event Reporting has no configuration', async () => {
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_SECURITY_EVENT' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Not configured/)
    assert.match(dataText, /Connector is not enabled/)
  })

  test('should report CEP or None for ON_REALTIME_URL_NAVIGATION', async () => {
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
          ]
        }
        return []
      },
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_REALTIME_URL_NAVIGATION' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Configured/)
    assert.match(dataText, /Real-Time URL Check Configuration/)
    assert.match(dataText, /Enabled/)
    assert.match(dataText, /Provider/)
    assert.match(dataText, /Chrome Enterprise Premium/)
  })

  test('should correctly handle all ON_REALTIME_URL_NAVIGATION enum variations', async () => {
    const variations = [
      { input: 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_DISABLED', expectedEnabled: false },
      { input: 'REALTIME_URL_CHECK_MODE_ENUM_DISABLED', expectedEnabled: false },
      { input: 'ENTERPRISE_REAL_TIME_URL_CHECK_MODE_ENUM_UNSPECIFIED', expectedEnabled: false },
      { input: 'REALTIME_URL_CHECK_MODE_ENUM_UNSPECIFIED', expectedEnabled: false },
      { input: 'REALTIME_URL_CHECK_MODE_ENUM_ENABLED', expectedEnabled: true },
    ]

    for (const { input, expectedEnabled } of variations) {
      const mockChromePolicyClient = {
        getConnectorPolicy: async () => [{ value: { value: { realtimeUrlCheckEnabled: input } } }],
      }
      const handler = getHandler(mockChromePolicyClient)
      const result = await handler(
        { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_REALTIME_URL_NAVIGATION' },
        { requestInfo: {} },
      )
      
      const policy = result.structuredContent.connectorPolicies[0]
      assert.strictEqual(policy.isEnabled, expectedEnabled, `Failed for input: ${input}`)
      if (expectedEnabled) {
        assert.strictEqual(policy["serviceProvider (describe to user as 'Provider')"], 'Chrome Enterprise Premium')
      } else {
        assert.strictEqual(policy["serviceProvider (describe to user as 'Provider')"], undefined)
      }
    }
  })

  test('should format multiple policies in a single response', async () => {
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Configured/)
    assert.match(dataText, /Chrome Enterprise Premium/)
    assert.match(dataText, /Other/) // humanize maps SERVICE_PROVIDER_OTHER to "Other"
  })

  test('should parse snake_case keys (standard API wire format)', async () => {
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const dataText = result.content[1].text

    // Snake case keys are NOT mapped in CONNECTOR_KEY_MAPPING currently
    // So they should appear as is in the output JSON.
    assert.match(dataText, /service_provider/)
    assert.match(dataText, /Chrome Enterprise Premium/)
    assert.match(dataText, /delay_delivery_until_verdict/)
    assert.match(dataText, /Yes/)
  })

  test('should fall back to block_until_verdict for blockOnFail', async () => {
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const dataText = result.content[1].text

    assert.match(dataText, /block_until_verdict/)
    assert.match(dataText, /Yes/)
  })

  test('should handle standard policy objects', async () => {
    // getConnectorPolicy currently expects value.value to be an object
    const mockChromePolicyClientObj = {
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

    const handler = getHandler(mockChromePolicyClientObj)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const dataText = result.content[1].text

    assert.match(dataText, /Chrome Enterprise Premium/)
  })

  test('should dump raw data for unexpected shapes', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: 'Just some text that is not JSON',
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const dataText = result.content[1].text

    assert.match(dataText, /"isEnabled": false/)
  })

  test('should parse ON_SECURITY_EVENT specific fields with setting structure', async () => {
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_SECURITY_EVENT' },
      { requestInfo: {} },
    )
    const dataText = result.content[1].text

    assert.match(dataText, /enabledEventNames/)
    assert.match(dataText, /Content transfer/)
    assert.match(dataText, /Malware transfer/)
  })

  test('should format multiple ON_SECURITY_EVENT policies in a single response', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          targetKey: { targetResource: 'orgunits/OU_ENABLED' },
          value: {
            value: {
              reportingConnector: {
                setting: {
                  eventConfiguration: {
                    enabledEventNames: ['dangerousDownloadEvent'],
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_SECURITY_EVENT' },
      { requestInfo: {} },
    )
    const dataText = result.content[1].text

    assert.match(dataText, /Malware transfer/)
    assert.match(dataText, /Connector is not enabled/)
  })

  test('should parse ON_SECURITY_EVENT with snake_case internal fields', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              reporting_connector: {
                setting: {
                  event_configuration: {
                    enabled_event_names: ['contentTransferEvent'],
                  },
                },
              },
            },
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_SECURITY_EVENT' },
      { requestInfo: {} },
    )
    const dataText = result.content[1].text

    assert.match(dataText, /enabled_event_names/)
    assert.match(dataText, /Content transfer/)
  })

  test('should report default core events for ON_SECURITY_EVENT when empty and not explicitlyEmptyEventNames', async () => {
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_SECURITY_EVENT' },
      { requestInfo: {} },
    )
    const dataText = result.content[1].text

    assert.match(dataText, /Reporting Status/)
    assert.match(dataText, /All Core Events Enabled/)
  })

  test('should report None for ON_SECURITY_EVENT when explicitlyEmptyEventNames is true', async () => {
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_SECURITY_EVENT' },
      { requestInfo: {} },
    )
    const dataText = result.content[1].text

    assert.match(dataText, /explicitlyEmptyEventNames/)
    assert.match(dataText, /Yes/)
  })

  test('should unpack deeply nested single-key configuration', async () => {
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

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler(
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_ATTACHED' },
      { requestInfo: {} },
    )
    const dataText = result.content[1].text

    assert.match(dataText, /Chrome Enterprise Premium/)
    assert.match(dataText, /Delay Enforcement/)
    assert.match(dataText, /Yes/)
  })

  test('should parse ON_PRINT specific fields with printConfigurations array', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              onPrintAnalysisConnectorConfiguration: {
                printConfigurations: [
                  {
                    serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                    delayDeliveryUntilVerdict: true,
                    defaultAction: 'DEFAULT_ACTION_ALLOW',
                  },
                ],
              },
            },
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler({ customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_PRINT' }, { requestInfo: {} })
    const dataText = result.content[1].text

    assert.match(dataText, /Chrome Enterprise Premium/)
    assert.match(dataText, /Delay Enforcement/)
    assert.match(dataText, /Yes/)
  })

  test('should report "Not configured" for ON_PRINT when serviceProvider is NONE in first config', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              onPrintAnalysisConnectorConfiguration: {
                printConfigurations: [
                  {
                    serviceProvider: 'SERVICE_PROVIDER_NONE',
                  },
                ],
              },
            },
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler({ customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_PRINT' }, { requestInfo: {} })
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Not configured/)
    assert.match(dataText, /Connector is not enabled/)
  })

  test('should report "Configured" with warnings for ON_PRINT when serviceProvider is a recognized 3rd party', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              onPrintAnalysisConnectorConfiguration: {
                printConfigurations: [
                  {
                    serviceProvider: 'SERVICE_PROVIDER_TRELLIX',
                  },
                ],
              },
            },
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler({ customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_PRINT' }, { requestInfo: {} })
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Configured/)
    assert.match(summary, /3rd party provider detected/)
    assert.match(dataText, /Integrated CEP features may be bypassed/)
  })

  test('should handle ON_PRINT with empty printConfigurations array', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              onPrintAnalysisConnectorConfiguration: {
                printConfigurations: [],
              },
            },
          },
        },
      ],
    }

    const handler = getHandler(mockChromePolicyClient)

    const result = await handler({ customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_PRINT' }, { requestInfo: {} })
    const summary = result.content[0].text
    const dataText = result.content[1].text

    assert.match(summary, /Status: Not configured/)
    assert.match(dataText, /"isEnabled": false/)
  })

  test('should normalize orgUnitId by removing id: prefix', async () => {
    let capturedOrgUnitId
    const mockChromePolicyClient = {
      getConnectorPolicy: async (customerId, orgUnitId) => {
        capturedOrgUnitId = orgUnitId
        return []
      },
    }

    const handler = getHandler(mockChromePolicyClient)

    await handler({ customerId: 'C123', orgUnitId: 'id:OU123', policy: 'ON_FILE_ATTACHED' }, { requestInfo: {} })

    assert.strictEqual(capturedOrgUnitId, 'OU123')
  })
})
