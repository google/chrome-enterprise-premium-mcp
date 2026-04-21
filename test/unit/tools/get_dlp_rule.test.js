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
import { registerGetDlpRuleTool } from '../../../tools/definitions/get_dlp_rule.js'

describe('get_dlp_rule tool handler', () => {
  const getHandler = mockCloudIdentityClient => {
    let registeredHandler
    const mockServer = {
      registerTool(name, config, handler) {
        if (name === 'get_dlp_rule') {
          registeredHandler = handler
        }
      },
    }
    registerGetDlpRuleTool(mockServer, { cloudIdentityClient: mockCloudIdentityClient }, {})
    return registeredHandler
  }

  test('When a rule has complete data, then it formats rule details and includes a UI link', async () => {
    const mockRule = {
      name: 'policies/rule123',
      displayName: 'Block Secret Uploads',
      setting: {
        value: {
          state: 'ACTIVE',
          triggers: ['chrome.dlp.v1.FILE_UPLOAD'],
          action: {
            chromeAction: {
              blockContent: {},
            },
          },
          condition: {
            contentCondition: "all_content.contains('secret')",
          },
        },
      },
    }

    const mockCloudIdentityClient = {
      getDlpRule: async () => mockRule,
    }

    const handler = getHandler(mockCloudIdentityClient)

    const result = await handler({ resourceName: 'policies/rule123' }, { authToken: 'token' })
    const text = result.content[0].text

    assert.match(text, /## DLP Rule: Block Secret Uploads/)
    assert.match(text, /\*\*Status\*\*: Active/)
    assert.match(text, /\*\*Action\*\*: Block/)
    assert.match(text, /\*\*Triggers\*\*: FILE_UPLOAD/)
    assert.match(text, /\[Manage in UI\]\(https:\/\/admin\.google\.com\/ac\/dp\/rules\/policies%2Frule123\)/)

    assert.strictEqual(
      result.structuredContent.dlpRule.uiLink,
      'https://admin.google.com/ac/dp/rules/policies%2Frule123',
    )
  })

  test('When a rule has missing fields, then it handles them gracefully', async () => {
    const mockRule = {
      name: 'policies/empty',
    }

    const mockCloudIdentityClient = {
      getDlpRule: async () => mockRule,
    }

    const handler = getHandler(mockCloudIdentityClient)

    const result = await handler({ resourceName: 'policies/empty' }, { authToken: 'token' })
    const text = result.content[0].text

    assert.match(text, /DLP Rule: Unnamed Rule/)
    assert.match(text, /\*\*Status\*\*: Unknown/)
    assert.match(text, /\*\*Action\*\*: Unknown/)
  })
})
