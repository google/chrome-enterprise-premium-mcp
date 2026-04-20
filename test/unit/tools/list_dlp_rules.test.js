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
import { registerListDlpRulesTool } from '../../../tools/definitions/list_dlp_rules.js'

describe('list_dlp_rules tool handler', () => {
  const getHandler = mockCloudIdentityClient => {
    let registeredHandler
    const mockServer = {
      registerTool(name, config, handler) {
        if (name === 'list_dlp_rules') {
          registeredHandler = handler
        }
      },
    }
    registerListDlpRulesTool(mockServer, { cloudIdentityClient: mockCloudIdentityClient }, {})
    return registeredHandler
  }

  const mockContext = {
    requestInfo: {
      headers: {
        authorization: 'Bearer token',
      },
    },
  }

  test('When no rules are found, then it returns a graceful empty message', async () => {
    const mockCloudIdentityClient = {
      listDlpRules: async () => [],
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)

    assert.match(result.content[0].text, /No Chrome DLP rules were found/)
    assert.deepStrictEqual(result.structuredContent.dlpRules, [])
  })

  test('When a rule has complete data, then it formats all details correctly', async () => {
    const mockPolicies = [
      {
        name: 'policies/rule1',
        displayName: 'Rule 1',
        setting: {
          value: {
            displayName: 'Active Block Rule',
            state: 'ACTIVE',
            triggers: ['google.workspace.chrome.FILE_UPLOAD.v1'],
            action: {
              chromeAction: {
                blockContent: {},
              },
            },
            condition: {
              contentCondition: 'matches_detector(policies/detector1)',
            },
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /## DLP Rules \(1\)/)
    assert.match(
      text,
      /\*\*Active Block Rule\*\* — status: Active, action: Block, triggers: FILE_UPLOAD, condition: `matches_detector\(policies\/detector1\)`/,
    )
    assert.match(text, /"Active Block Rule" → `policies\/rule1`/)
    assert.deepStrictEqual(result.structuredContent.dlpRules, mockPolicies)
  })

  test('When a status is in SNAKE_CASE, then it is formatted to Title Case', async () => {
    const mockPolicies = [
      {
        name: 'policies/status-test',
        setting: {
          value: {
            displayName: 'Status Rule',
            state: 'PARTIALLY_ENFORCED',
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /status: Partially Enforced/)
  })

  test('When value.state is missing, then it falls back to setting.state', async () => {
    const mockPolicies = [
      {
        name: 'policies/fallback-state',
        setting: {
          state: 'INACTIVE', // Present at setting level
          value: {
            displayName: 'Fallback State Rule',
            // state missing at value level
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /status: Inactive/)
  })

  test('When both value.state and setting.state are missing, then status is "Unknown"', async () => {
    const mockPolicies = [
      {
        name: 'policies/no-state',
        setting: {
          value: {
            displayName: 'No State Rule',
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /status: Unknown/)
  })

  test('When displayName is available at different levels, then it prioritizes them correctly', async () => {
    const mockPolicies = [
      {
        name: 'policies/rule1',
        setting: {
          displayName: 'Setting Display Name',
          value: {
            state: 'ACTIVE',
          },
        },
      },
      {
        name: 'policies/rule2',
        displayName: 'Root Display Name',
        setting: {
          value: {
            state: 'ACTIVE',
          },
        },
      },
      {
        name: 'policies/rule3',
        setting: {
          value: {
            state: 'ACTIVE',
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /Setting Display Name/)
    assert.match(text, /Root Display Name/)
    assert.match(text, /Unnamed Rule/)
  })

  test('When name is missing from value and setting, then it falls back to root displayName', async () => {
    const mockPolicies = [
      {
        name: 'policies/root-name',
        displayName: 'Root Name Only',
        setting: {
          value: {
            state: 'ACTIVE',
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /Root Name Only/)
  })

  test('When different chromeActions are provided, then it maps them to human-readable actions', async () => {
    const mockPolicies = [
      {
        name: 'policies/warn',
        setting: {
          value: {
            displayName: 'Warn Rule',
            action: { chromeAction: { warnUser: {} } },
          },
        },
      },
      {
        name: 'policies/audit',
        setting: {
          value: {
            displayName: 'Audit Rule',
            action: { chromeAction: { auditOnly: {} } },
          },
        },
      },
      {
        name: 'policies/unknown',
        setting: {
          value: {
            displayName: 'Unknown Rule',
            action: { chromeAction: {} },
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /Warn Rule.*action: Warn/)
    assert.match(text, /Audit Rule.*action: Audit/)
    assert.match(text, /Unknown Rule.*action: Unknown/)
  })

  test('When chromeAction keys are unrecognized, then it defaults to "Unknown" action', async () => {
    const mockPolicies = [
      {
        name: 'policies/unknown-action',
        setting: {
          value: {
            displayName: 'Mystery Rule',
            action: {
              chromeAction: {
                mysteryAction: {},
              },
            },
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /action: Unknown/)
  })

  test('When triggers have various infrastructure prefixes or versioning, then it cleans them correctly', async () => {
    const mockPolicies = [
      {
        name: 'policies/triggers',
        setting: {
          value: {
            displayName: 'Trigger Rule',
            triggers: [
              'google.workspace.chrome.FILE_UPLOAD.v1',
              'chrome.PRINT',
              'WEB_CONTENT_UPLOAD',
              'google.workspace.chrome.file.v1.upload',
              'chrome.dlp.v1.page_print',
            ],
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /triggers: FILE_UPLOAD, PRINT, WEB_CONTENT_UPLOAD, file.upload, dlp.page_print/)
  })

  test('When the triggers field is missing, then it defaults to an empty list safely', async () => {
    const mockPolicies = [
      {
        name: 'policies/missing-triggers',
        setting: {
          value: {
            displayName: 'Missing Triggers Rule',
            triggers: undefined,
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /triggers: ,/)
  })

  test('When a rule condition is missing, then it defaults to "None"', async () => {
    const mockPolicies = [
      {
        name: 'policies/no-condition',
        setting: {
          value: {
            displayName: 'No Condition Rule',
          },
        },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /condition: `None`/)
  })

  test('When multiple rules are returned, then they are all included in the summary and resource map', async () => {
    const mockPolicies = [
      {
        name: 'policies/rule1',
        setting: { value: { displayName: 'Rule A', state: 'ACTIVE' } },
      },
      {
        name: 'policies/rule2',
        setting: { value: { displayName: 'Rule B', state: 'INACTIVE' } },
      },
    ]

    const mockCloudIdentityClient = {
      listDlpRules: async () => mockPolicies,
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)
    const text = result.content[0].text

    assert.match(text, /## DLP Rules \(2\)/)
    assert.match(text, /Rule A/)
    assert.match(text, /Rule B/)
    assert.match(text, /"Rule A" → `policies\/rule1`/)
    assert.match(text, /"Rule B" → `policies\/rule2`/)
  })

  test('When the API call fails, then it returns a formatted error message', async () => {
    const mockCloudIdentityClient = {
      listDlpRules: async () => {
        throw new Error('API Error')
      },
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({}, mockContext)

    assert.strictEqual(result.content[0].text, 'Error: API Error')
    assert.strictEqual(result.isError, true)
  })
})
