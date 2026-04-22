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

  test('When standard camelCase keys are provided, then it parses them correctly', async () => {
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

  test('When Real-time URL check is disabled, then it reports "Not configured"', async () => {
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
    assert.match(
      dataText,
      /"realtimeUrlCheckEnabled \(describe to user as 'Real-Time URL Check Configuration'\)": "No"/,
    )
    assert.strictEqual(result.structuredContent.configured, false)
  })

  test('When sub-optimal CEP settings are found, then it reports "Configured" with warnings', async () => {
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

  test('When generic unknown providers are used, then it reports "Configured" without 3rd party warnings', async () => {
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

  test('When Symantec/Trellix 3rd party providers are detected, then it reports "Configured" with warnings', async () => {
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

  test('When Analysis Provider is UNSPECIFIED, then it reports "Not configured"', async () => {
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

  test('When Analysis Provider is NONE, then it reports "Not configured"', async () => {
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

  test('When Event Reporting has no configuration, then it reports "Not configured"', async () => {
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

  test('When ON_REALTIME_URL_NAVIGATION is requested, then it reports CEP status correctly', async () => {
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

  test('When ON_REALTIME_URL_NAVIGATION enum variations are tested, then it maps them correctly to boolean enabled state', async () => {
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

  test('When multiple policies are found, then it formats all of them in a single response', async () => {
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

  test('When API returns snake_case keys, then it parses them correctly and preserves field names', async () => {
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

  test('When block_until_verdict is used, then it falls back correctly for blockOnFail', async () => {
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

  test('When standard policy objects are provided, then it handles them correctly', async () => {
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

  test('When unexpected data shapes are encountered, then it dumps raw data gracefully', async () => {
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

  test('When ON_SECURITY_EVENT specific fields are provided, then it parses them correctly', async () => {
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

  test('When multiple ON_SECURITY_EVENT policies are present, then it formats all in a single response', async () => {
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

  test('When ON_SECURITY_EVENT uses snake_case internal fields, then it parses them correctly', async () => {
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

  test('When ON_SECURITY_EVENT has empty event list without explicitlyEmptyEventNames, then it reports default core events', async () => {
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

  test('When explicitlyEmptyEventNames is true for ON_SECURITY_EVENT, then it reports None', async () => {
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

  test('When deeply nested single-key configuration is used, then it unpacks correctly', async () => {
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

  test('When ON_PRINT specific fields with printConfigurations array are provided, then it parses them correctly', async () => {
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

  test('When serviceProvider is NONE in first print config, then it reports "Not configured" for ON_PRINT', async () => {
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

  test('When a recognized 3rd party provider is used in ON_PRINT, then it reports "Configured" with warnings', async () => {
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

  test('When printConfigurations array is empty, then it handles ON_PRINT correctly', async () => {
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

  test('When orgUnitId has id: prefix, then it normalizes it by removing the prefix', async () => {
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

  test('When ON_PRINT has sensitive scanning restricted (Inclusion List), then it reports "ONLY enabled" warning', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              onPrintAnalysisConnectorConfiguration: {
                printConfigurations: [
                  {
                    serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                    sensitiveUrlPatterns: {
                      onByDefault: false,
                      urlPatterns: ['print-only.com'],
                    },
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

    assert.match(summary, /⚠️ Sensitive Analysis is restricted. Scanning is ONLY enabled for specific URL patterns/)
    assert.doesNotMatch(summary, /⚠️ Malware Analysis is restricted/)
    assert.match(dataText, /"sensitiveOnByDefault \(describe to user as 'Sensitive Scan All'\)": "No"/)
  })

  test('When ON_FILE_DOWNLOAD has Malware restricted (Exclusion List) and Sensitive restricted (Disabled), then it reports specific warnings', async () => {
    const mockChromePolicyClient = {
      getConnectorPolicy: async () => [
        {
          value: {
            value: {
              onFileDownloadedAnalysisConnectorConfiguration: {
                fileDownloadedConfiguration: {
                  serviceProvider: 'SERVICE_PROVIDER_CHROME_ENTERPRISE_PREMIUM',
                  malwareUrlPatterns: {
                    onByDefault: true,
                    urlPatterns: ['malware-check.com'],
                  },
                  sensitiveUrlPatterns: {
                    onByDefault: false,
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
      { customerId: 'C123', orgUnitId: 'OU123', policy: 'ON_FILE_DOWNLOAD' },
      { requestInfo: {} },
    )
    const summary = result.content[0].text

    assert.match(summary, /⚠️ Malware Analysis is restricted. Scanning is DISABLED for specific URL patterns/)
    assert.match(summary, /⚠️ Sensitive Analysis is restricted. Scanning is NOT enabled for all files/)
  })
})
