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

/**
 * @fileoverview Tests for Cloud Identity API tool handlers.
 */

import assert from 'node:assert/strict'
import { describe, it, mock, beforeEach } from 'node:test'
import esmock from 'esmock'

describe('Cloud Identity API', () => {
  let server

  beforeEach(async () => {
    server = {
      registerTool: mock.fn(),
    }
  })

  describe('list_dlp_rules Tool', () => {
    it('should call listDlpRules and return formatted result', async () => {
      const mockListDlpRules = mock.fn(async () => [
        {
          setting: {
            value: {
              triggers: ['google.workspace.chrome.file.v1.upload'],
              displayName: 'rule1',
            },
          },
        },
      ])
      const MockCloudIdentityClient = class {
        constructor() {
          this.listDlpRules = mockListDlpRules
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_dlp_rules').arguments[2]
      const result = await handler({ type: 'rule' }, { requestInfo: {} })
      assert.strictEqual(mockListDlpRules.mock.callCount(), 1)
      assert.ok(result.content[0].text.includes('rule1'))
    })

    it('should return an error message if API call fails', async () => {
      const mockListDlpRules = mock.fn(async () => {
        throw new Error('API Error')
      })
      const MockCloudIdentityClient = class {
        constructor() {
          this.listDlpRules = mockListDlpRules
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_dlp_rules').arguments[2]

      const result = await handler({ type: 'rule' }, { requestInfo: {} })
      assert.deepStrictEqual(result.content[0].text, 'Error: API Error')
    })
  })

  describe('create_chrome_dlp_rule Tool', () => {
    it('should map BLOCK action correctly', async () => {
      const mockCreateDlpRule = mock.fn(async () => ({ name: 'policies/123' }))
      const MockCloudIdentityClient = class {
        constructor() {
          this.createDlpRule = mockCreateDlpRule
        }
      }
      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_chrome_dlp_rule')
        .arguments[2]
      await handler(
        {
          customerId: 'C0123',
          orgUnitId: 'ou1',
          displayName: 'Block Rule',
          triggers: ['FILE_UPLOAD'],
          action: 'BLOCK',
        },
        { requestInfo: {} },
      )

      const passedConfig = mockCreateDlpRule.mock.calls[0].arguments[2]
      assert.deepStrictEqual(passedConfig.action, { chromeAction: { blockContent: {} } })
    })

    it('should prefix the displayName', async () => {
      const mockCreateDlpRule = mock.fn(async () => ({ name: 'policies/123' }))
      const MockCloudIdentityClient = class {
        constructor() {
          this.createDlpRule = mockCreateDlpRule
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_chrome_dlp_rule')
        .arguments[2]

      await handler(
        {
          customerId: 'C0123',
          orgUnitId: 'ou1',
          displayName: 'Test Rule',
          triggers: ['FILE_UPLOAD'],
          condition: "url.contains('test')",
          action: 'WARN',
        },
        { requestInfo: {} },
      )

      const passedConfig = mockCreateDlpRule.mock.calls[0].arguments[2]
      assert.strictEqual(passedConfig.displayName, '🤖 Test Rule')
    })

    it('should call createDlpRule and return formatted result', async () => {
      const mockCreateDlpRule = mock.fn(async () => ({ name: 'policies/123' }))
      const MockCloudIdentityClient = class {
        constructor() {
          this.createDlpRule = mockCreateDlpRule
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_chrome_dlp_rule')
        .arguments[2]

      const result = await handler(
        {
          customerId: 'C0123',
          orgUnitId: 'ou1',
          displayName: 'Test Rule',
          triggers: ['FILE_UPLOAD'],
          condition: "url.contains('test')",
          action: 'WARN',
        },
        { requestInfo: {} },
      )

      assert.strictEqual(mockCreateDlpRule.mock.callCount(), 1)
      const passedConfig = mockCreateDlpRule.mock.calls[0].arguments[2]
      assert.deepStrictEqual(passedConfig.condition, {
        contentCondition: "url.contains('test')",
      })
      const expectedText = `Successfully created Chrome DLP rule: policies/123\n\nDetails:\n{\n  "name": "policies/123"\n}`
      assert.deepStrictEqual(result.content[0].text, expectedText)
    })

    it('should pass dataMasking parameters to createDlpRule', async () => {
      const mockCreateDlpRule = mock.fn(async () => ({ name: 'policies/123' }))
      const MockCloudIdentityClient = class {
        constructor() {
          this.createDlpRule = mockCreateDlpRule
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_chrome_dlp_rule')
        .arguments[2]

      await handler(
        {
          customerId: 'C0123',
          orgUnitId: 'ou1',
          displayName: 'Masking Rule',
          triggers: ['URL_NAVIGATION'],
          condition: "url.contains('test')",
          action: 'AUDIT',
          dataMasking: {
            regexDetectors: [
              {
                maskType: 'MASK_TYPE_REDACT',
                resourceName: 'policies/abc-123',
                displayName: 'My Regex',
              },
            ],
          },
        },
        { requestInfo: {} },
      )

      assert.strictEqual(mockCreateDlpRule.mock.callCount(), 1)
      const passedConfig = mockCreateDlpRule.mock.calls[0].arguments[2]
      assert.deepStrictEqual(passedConfig.action.chromeAction.auditOnly.actionParams.dataMasking, {
        regexDetector: [
          {
            maskType: 'MASK_TYPE_REDACT',
            resourceName: 'policies/abc-123',
            displayName: 'My Regex',
          },
        ],
      })
    })

    it('should not include condition in ruleConfig if not provided', async () => {
      const mockCreateDlpRule = mock.fn(async () => ({ name: 'policies/123' }))
      const MockCloudIdentityClient = class {
        constructor() {
          this.createDlpRule = mockCreateDlpRule
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_chrome_dlp_rule')
        .arguments[2]

      await handler(
        {
          customerId: 'C0123',
          orgUnitId: 'ou1',
          displayName: 'Test Rule No Condition',
          triggers: ['FILE_UPLOAD'],
          // condition is omitted
          action: 'WARN',
        },
        { requestInfo: {} },
      )

      assert.strictEqual(mockCreateDlpRule.mock.callCount(), 1)
      const passedConfig = mockCreateDlpRule.mock.calls[0].arguments[2]
      assert.strictEqual(passedConfig.condition, undefined)
      assert.ok(!Object.hasOwn(passedConfig, 'condition'))
    })

    it('should return an error message if API call fails', async () => {
      const mockCreateDlpRule = mock.fn(async () => {
        throw new Error('API Error')
      })
      const MockCloudIdentityClient = class {
        constructor() {
          this.createDlpRule = mockCreateDlpRule
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_chrome_dlp_rule')
        .arguments[2]

      const result = await handler(
        {
          customerId: 'C0123',
          orgUnitId: 'ou1',
          displayName: 'Test Rule',
          triggers: ['FILE_UPLOAD'],
          condition: "url.contains('test')",
          action: 'WARN',
        },
        { requestInfo: {} },
      )
      assert.deepStrictEqual(result.content[0].text, 'Error: API Error')
    })
  })

  describe('create_regex_detector Tool', () => {
    it('should call createDetector and return formatted result', async () => {
      const mockCreateDetector = mock.fn(async () => ({ name: 'policies/regex1' }))
      const MockCloudIdentityClient = class {
        constructor() {
          this.createDetector = mockCreateDetector
        }
      }
      const MockAdminSdkClient = class {
        constructor() {
          this.listOrgUnits = mock.fn(async () => ({
            organizationUnits: [{ orgUnitId: 'root-id', orgUnitPath: '/' }],
          }))
          this.getCustomerId = mock.fn(async () => ({ id: 'C0123' }))
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
          '../../lib/api/real_admin_sdk_client.js': {
            RealAdminSdkClient: MockAdminSdkClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: {
          cloudIdentity: new MockCloudIdentityClient(),
          adminSdk: new MockAdminSdkClient(),
        },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_regex_detector')
        .arguments[2]
      const result = await handler(
        {
          customerId: 'C0123',
          displayName: 'Regex Detector',
          expression: '.*test.*',
        },
        { requestInfo: {} },
      )

      assert.strictEqual(mockCreateDetector.mock.callCount(), 1)
      const passedConfig = mockCreateDetector.mock.calls[0].arguments[2]
      assert.deepStrictEqual(passedConfig, {
        displayName: 'Regex Detector',
        description: '',
        regular_expression: { expression: '.*test.*' },
      })
      assert.ok(result.content[0].text.includes('policies/regex1'))
    })
  })

  describe('create_url_list_detector Tool', () => {
    it('should call createDetector and return formatted result', async () => {
      const mockCreateDetector = mock.fn(async () => ({ name: 'policies/url1' }))
      const MockCloudIdentityClient = class {
        constructor() {
          this.createDetector = mockCreateDetector
        }
      }
      const MockAdminSdkClient = class {
        constructor() {
          this.listOrgUnits = mock.fn(async () => ({
            organizationUnits: [{ orgUnitId: 'root-id', orgUnitPath: '/' }],
          }))
          this.getCustomerId = mock.fn(async () => ({ id: 'C0123' }))
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
          '../../lib/api/real_admin_sdk_client.js': {
            RealAdminSdkClient: MockAdminSdkClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: {
          cloudIdentity: new MockCloudIdentityClient(),
          adminSdk: new MockAdminSdkClient(),
        },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_url_list_detector')
        .arguments[2]
      const result = await handler(
        {
          customerId: 'C0123',
          displayName: 'URL Detector',
          urls: ['test.com'],
        },
        { requestInfo: {} },
      )

      assert.strictEqual(mockCreateDetector.mock.callCount(), 1)
      const passedConfig = mockCreateDetector.mock.calls[0].arguments[2]
      assert.deepStrictEqual(passedConfig, {
        displayName: 'URL Detector',
        description: '',
        url_list: { urls: ['test.com'] },
      })
      assert.ok(result.content[0].text.includes('policies/url1'))
    })
  })

  describe('create_word_list_detector Tool', () => {
    it('should call createDetector and return formatted result', async () => {
      const mockCreateDetector = mock.fn(async () => ({ name: 'policies/word1' }))
      const MockCloudIdentityClient = class {
        constructor() {
          this.createDetector = mockCreateDetector
        }
      }
      const MockAdminSdkClient = class {
        constructor() {
          this.listOrgUnits = mock.fn(async () => ({
            organizationUnits: [{ orgUnitId: 'root-id', orgUnitPath: '/' }],
          }))
          this.getCustomerId = mock.fn(async () => ({ id: 'C0123' }))
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
          '../../lib/api/real_admin_sdk_client.js': {
            RealAdminSdkClient: MockAdminSdkClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: {
          cloudIdentity: new MockCloudIdentityClient(),
          adminSdk: new MockAdminSdkClient(),
        },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_word_list_detector')
        .arguments[2]
      const result = await handler(
        {
          customerId: 'C0123',
          displayName: 'Word Detector',
          words: ['secret'],
        },
        { requestInfo: {} },
      )

      assert.strictEqual(mockCreateDetector.mock.callCount(), 1)
      const passedConfig = mockCreateDetector.mock.calls[0].arguments[2]
      assert.deepStrictEqual(passedConfig, {
        displayName: 'Word Detector',
        description: '',
        word_list: { words: ['secret'] },
      })
      assert.ok(result.content[0].text.includes('policies/word1'))
    })

    it('should throw an error if root OU resolution fails', async () => {
      const MockCloudIdentityClient = class {
        constructor() {
          this.createDetector = mock.fn()
        }
      }
      const mockListOrgUnits = mock.fn(async () => ({ organizationUnits: [] }))
      const MockAdminSdkClient = class {
        constructor() {
          this.listOrgUnits = mockListOrgUnits
          this.getCustomerId = mock.fn(async () => ({ id: 'C0123' }))
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
          '../../lib/api/real_admin_sdk_client.js': {
            RealAdminSdkClient: MockAdminSdkClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: {
          cloudIdentity: new MockCloudIdentityClient(),
          adminSdk: new MockAdminSdkClient(),
        },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_word_list_detector')
        .arguments[2]

      const result = await handler(
        {
          customerId: 'C0123',
          displayName: 'Word Detector',
          words: ['secret'],
        },
        { requestInfo: {} },
      )

      assert.strictEqual(result.content[0].text, 'Error: Failed to resolve root organizational unit ID.')
    })
  })

  describe('delete_dlp_rule Tool', () => {
    it('should call deleteDlpRule and return success message', async () => {
      const mockDeleteDlpRule = mock.fn(async () => ({}))
      const MockCloudIdentityClient = class {
        constructor() {
          this.deleteDlpRule = mockDeleteDlpRule
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'delete_dlp_rule').arguments[2]
      const result = await handler({ policyName: 'policies/123' }, { requestInfo: {} })

      assert.strictEqual(mockDeleteDlpRule.mock.callCount(), 1)
      assert.ok(result.content[0].text.includes('Successfully deleted DLP rule: policies/123'))
    })
  })

  describe('delete_detector Tool', () => {
    it('should call deleteDetector and return success message', async () => {
      const mockDeleteDetector = mock.fn(async () => ({}))
      const MockCloudIdentityClient = class {
        constructor() {
          this.deleteDetector = mockDeleteDetector
        }
      }

      const { registerTools } = await esmock(
        '../../tools/tools.js',
        {},
        {
          '../../lib/api/real_cloud_identity_client.js': {
            RealCloudIdentityClient: MockCloudIdentityClient,
          },
        },
      )
      registerTools(server, {
        gcpCredentialsAvailable: true,
        apiClients: { cloudIdentity: new MockCloudIdentityClient() },
      })

      const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'delete_detector').arguments[2]
      const result = await handler({ policyName: 'policies/456' }, { requestInfo: {} })

      assert.strictEqual(mockDeleteDetector.mock.callCount(), 1)
      assert.ok(result.content[0].text.includes('Successfully deleted detector policy: policies/456'))
    })
  })
})
