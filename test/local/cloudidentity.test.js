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
        it('should call listDlpPolicies and return formatted result', async () => {
            const mockListDlpPolicies = mock.fn(async () => [
                {
                    setting: {
                        value: {
                            triggers: ['google.workspace.chrome.file.v1.upload'],
                            displayName: 'rule1',
                        },
                    },
                },
                {
                    setting: {
                        value: {
                            triggers: ['google.workspace.chrome.file.v1.download'],
                            displayName: 'rule2',
                        },
                    },
                },
            ])

            const { registerTools } = await esmock(
                '../../tools/tools.js',
                {},
                {
                    '../../lib/api/cloudidentity.js': {
                        listDlpPolicies: mockListDlpPolicies,
                    },
                },
            )
            registerTools(server, { gcpCredentialsAvailable: true })

            const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_dlp_rules')
                .arguments[2]

            const result = await handler({ type: 'rule' }, { requestInfo: {} })

            assert.strictEqual(mockListDlpPolicies.mock.callCount(), 1)
            const expectedText = `DLP rule:
[
  {
    "setting": {
      "value": {
        "triggers": [
          "google.workspace.chrome.file.v1.upload"
        ],
        "displayName": "rule1"
      }
    }
  },
  {
    "setting": {
      "value": {
        "triggers": [
          "google.workspace.chrome.file.v1.download"
        ],
        "displayName": "rule2"
      }
    }
  }
]`
            assert.deepStrictEqual(result.content[0].text, expectedText)
        })

        it('should return an error message if API call fails', async () => {
            const mockListDlpPolicies = mock.fn(async () => {
                throw new Error('API Error')
            })

            const { registerTools } = await esmock(
                '../../tools/tools.js',
                {},
                {
                    '../../lib/api/cloudidentity.js': {
                        listDlpPolicies: mockListDlpPolicies,
                    },
                },
            )
            registerTools(server, { gcpCredentialsAvailable: true })

            const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'list_dlp_rules')
                .arguments[2]

            const result = await handler({ type: 'rule' }, { requestInfo: {} })
            assert.deepStrictEqual(result.content[0].text, 'Error: API Error')
        })
    })

    describe('create_dlp_rule Tool', () => {
        it('should throw an error if action is "BLOCK"', async () => {
            const { registerTools } = await esmock(
                '../../tools/tools.js',
                {},
                {
                    '../../lib/api/cloudidentity.js': {
                        createDlpRule: mock.fn(),
                    },
                },
            )
            registerTools(server, { gcpCredentialsAvailable: true })

            const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_dlp_rule')
                .arguments[2]

            const result = await handler(
                {
                    action: 'BLOCK',
                    triggers: ['FILE_UPLOAD'],
                },
                { requestInfo: {} },
            )
            assert.deepStrictEqual(
                result.content[0].text,
                'Error: Creating DLP rules in "BLOCK" mode is not permitted. Supported actions are "AUDIT" and "WARN".',
            )
        })

        it('should prefix the displayName', async () => {
            const mockCreateDlpRule = mock.fn(async () => ({ name: 'policies/123' }))

            const { registerTools } = await esmock(
                '../../tools/tools.js',
                {},
                {
                    '../../lib/api/cloudidentity.js': {
                        createDlpRule: mockCreateDlpRule,
                    },
                },
            )
            registerTools(server, { gcpCredentialsAvailable: true })

            const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_dlp_rule')
                .arguments[2]

            await handler(
                {
                    customerId: 'C0123',
                    orgUnitId: 'ou1',
                    displayName: 'Test Rule',
                    triggers: ['FILE_UPLOAD'],
                    condition: 'true',
                    action: 'WARN',
                },
                { requestInfo: {} },
            )

            const passedConfig = mockCreateDlpRule.mock.calls[0].arguments[2]
            assert.strictEqual(passedConfig.displayName, '🤖 Test Rule')
        })

        it('should call createDlpRule and return formatted result', async () => {
            const mockCreateDlpRule = mock.fn(async () => ({ name: 'policies/123' }))

            const { registerTools } = await esmock(
                '../../tools/tools.js',
                {},
                {
                    '../../lib/api/cloudidentity.js': {
                        createDlpRule: mockCreateDlpRule,
                    },
                },
            )
            registerTools(server, { gcpCredentialsAvailable: true })

            const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_dlp_rule')
                .arguments[2]

            const result = await handler(
                {
                    customerId: 'C0123',
                    orgUnitId: 'ou1',
                    displayName: 'Test Rule',
                    triggers: ['FILE_UPLOAD'],
                    condition: 'true',
                    action: 'WARN',
                },
                { requestInfo: {} },
            )

            assert.strictEqual(mockCreateDlpRule.mock.callCount(), 1)
            const expectedText = `Successfully created DLP rule: policies/123

Details:
{
  "name": "policies/123"
}`
            assert.deepStrictEqual(result.content[0].text, expectedText)
        })

        it('should return an error message if API call fails', async () => {
            const mockCreateDlpRule = mock.fn(async () => {
                throw new Error('API Error')
            })

            const { registerTools } = await esmock(
                '../../tools/tools.js',
                {},
                {
                    '../../lib/api/cloudidentity.js': {
                        createDlpRule: mockCreateDlpRule,
                    },
                },
            )
            registerTools(server, { gcpCredentialsAvailable: true })

            const handler = server.registerTool.mock.calls.find(call => call.arguments[0] === 'create_dlp_rule')
                .arguments[2]

            const result = await handler(
                {
                    customerId: 'C0123',
                    orgUnitId: 'ou1',
                    displayName: 'Test Rule',
                    triggers: ['FILE_UPLOAD'],
                    condition: 'true',
                    action: 'WARN',
                },
                { requestInfo: {} },
            )
            assert.deepStrictEqual(result.content[0].text, 'Error: API Error')
        })
    })
})