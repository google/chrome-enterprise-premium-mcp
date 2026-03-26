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

import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import esmock from 'esmock'
import { WORKSPACE_RULE_LIMITS, AGENT_DISPLAY_NAME_PREFIX } from '../../lib/util/chrome_dlp_constants.js'

describe('Tool Input Validation', () => {
  const mockServer = {
    registerTool: mock.fn(),
  }
  const mockOptions = {
    cloudIdentityClient: {
      createDetector: mock.fn(() => ({ name: 'test' })),
      createDlpRule: mock.fn(() => ({ name: 'test' })),
    },
    apiClients: {},
  }

  describe('create_word_list_detector', async () => {
    const { registerCreateWordListDetectorTool } = await esmock(
      '../../tools/definitions/create_word_list_detector.js',
      {
        '../../tools/utils.js': {
          guardedToolCall: t => t,
          getAuthToken: () => 'token',
          resolveRootOrgUnitId: () => 'root',
          inputSchemas: { customerId: {} },
          outputSchemas: { singlePolicy: {} },
        },
      },
    )

    it('should have Zod validation for displayName length', async () => {
      mockServer.registerTool.mock.resetCalls()
      registerCreateWordListDetectorTool(mockServer, mockOptions, {})
      const toolDef = mockServer.registerTool.mock.calls.find(c => c.arguments[0] === 'create_word_list_detector')
      const schema = toolDef.arguments[1].inputSchema

      const longName = 'A'.repeat(WORKSPACE_RULE_LIMITS.NAME_MAX_LENGTH + 1)
      const result = schema.displayName.safeParse(longName)
      assert.strictEqual(result.success, false)
    })

    it('should throw error in handler if word list has too many total characters', async () => {
      mockServer.registerTool.mock.resetCalls()
      registerCreateWordListDetectorTool(mockServer, mockOptions, {})
      const toolDef = mockServer.registerTool.mock.calls.find(c => c.arguments[0] === 'create_word_list_detector')
      const handler = toolDef.arguments[2].handler

      const bigWord = 'A'.repeat(WORKSPACE_RULE_LIMITS.MAX_WORD_LIST_CHARS + 1)

      await assert.rejects(
        handler({ customerId: 'C123', displayName: 'Test', words: [bigWord] }, { requestInfo: {} }),
        { message: /character count/ },
      )
    })
  })

  describe('create_chrome_dlp_rule', async () => {
    const { registerCreateChromeDlpRuleTool } = await esmock('../../tools/definitions/create_chrome_dlp_rule.js', {
      '../../tools/utils.js': {
        guardedToolCall: t => t,
        getAuthToken: () => 'token',
        inputSchemas: { customerId: {}, orgUnitId: { describe: () => ({}) } },
        outputSchemas: { singlePolicy: {} },
      },
    })

    it('should have prefix-aware Zod validation for displayName', async () => {
      mockServer.registerTool.mock.resetCalls()
      registerCreateChromeDlpRuleTool(mockServer, mockOptions, {})
      const toolDef = mockServer.registerTool.mock.calls.find(c => c.arguments[0] === 'create_chrome_dlp_rule')
      const schema = toolDef.arguments[1].inputSchema

      const allowedLength =
        Math.floor((WORKSPACE_RULE_LIMITS.NAME_MAX_LENGTH - AGENT_DISPLAY_NAME_PREFIX.length) / 5) * 5

      const resultValid = schema.displayName.safeParse('A'.repeat(allowedLength))
      assert.strictEqual(resultValid.success, true)

      const resultInvalid = schema.displayName.safeParse('A'.repeat(allowedLength + 1))
      assert.strictEqual(resultInvalid.success, false)
    })
  })
})
