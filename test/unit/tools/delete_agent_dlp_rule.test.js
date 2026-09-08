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
import { registerDeleteAgentDlpRuleTool } from '../../../tools/definitions/delete_agent_dlp_rule.js'

describe('delete_agent_dlp_rule tool handler', () => {
  const getHandler = mockCloudIdentityClient => {
    let registeredHandler
    const mockServer = {
      registerTool(name, config, handler) {
        if (name === 'delete_agent_dlp_rule') {
          registeredHandler = handler
        }
      },
    }
    registerDeleteAgentDlpRuleTool(mockServer, { cloudIdentityClient: mockCloudIdentityClient }, {})
    return registeredHandler
  }

  const mockContext = {
    requestInfo: {
      headers: {
        authorization: 'Bearer token-abc',
      },
    },
  }

  test('When rule is agent-created, then deleteDlpRule (with re-validation) is NOT called', async () => {
    let getCalls = 0
    let preValidatedCalls = 0
    let validatedCalls = 0
    const mockCloudIdentityClient = {
      getDlpRule: async () => {
        getCalls++
        return { setting: { value: { displayName: '🤖 Agent Rule' } } }
      },
      deleteDlpRulePreValidated: async () => {
        preValidatedCalls++
        return {}
      },
      deleteDlpRule: async () => {
        validatedCalls++
        return {}
      },
    }

    const handler = getHandler(mockCloudIdentityClient)
    await handler({ policyName: 'policies/akabc123' }, mockContext)

    assert.strictEqual(getCalls, 1, 'getDlpRule should be called exactly once (no double policies.get)')
    assert.strictEqual(preValidatedCalls, 1, 'deleteDlpRulePreValidated should be called once')
    assert.strictEqual(validatedCalls, 0, 'deleteDlpRule (the re-validating path) should NOT be called')
  })

  test('When rule is agent-created, then it deletes the rule and returns success message', async () => {
    let deleteCalled = false
    const mockCloudIdentityClient = {
      getDlpRule: async () => ({
        setting: { value: { displayName: '🤖 Agent Rule' } },
      }),
      deleteDlpRulePreValidated: async () => {
        deleteCalled = true
        return {}
      },
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({ policyName: 'policies/akabc123' }, mockContext)

    assert.ok(deleteCalled, 'deleteDlpRulePreValidated should have been called')
    assert.ok(result.content[0].text.includes('has been successfully deleted'))
    assert.ok(result.content[0].text.includes('policies/akabc123'))
  })

  test('When rule is not agent-created, then it refuses deletion and returns Admin Console link', async () => {
    let deleteCalled = false
    const mockCloudIdentityClient = {
      getDlpRule: async () => ({
        setting: { value: { displayName: 'Manual Rule' } },
      }),
      deleteDlpRulePreValidated: async () => {
        deleteCalled = true
        return {}
      },
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({ policyName: 'policies/akabc123' }, mockContext)

    assert.ok(!deleteCalled, 'deleteDlpRulePreValidated should NOT have been called')
    assert.ok(result.content[0].text.includes('Admin Console'))
    assert.ok(
      result.content[0].text.includes('policies/akabc123') || result.content[0].text.includes('policies%2Fakabc123'),
      'response text should reference the policy',
    )
  })

  test('When getDlpRule returns 404, then the response contains a not-found error message', async () => {
    const notFoundError = new Error('Rule not found')
    notFoundError.response = { status: 404 }

    const mockCloudIdentityClient = {
      getDlpRule: async () => {
        throw notFoundError
      },
      deleteDlpRulePreValidated: async () => ({}),
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({ policyName: 'policies/akabc123' }, mockContext)

    assert.ok(result.isError, 'result should be an error response')
    assert.ok(result.content[0].text.includes('Rule not found'), 'error text should mention rule not found')
    assert.ok(result.content[0].text.includes('policies/akabc123'), 'error text should include the policy name')
  })

  test('When getDlpRule returns error code 5 (NOT_FOUND), then the response contains a not-found error message', async () => {
    const notFoundError = new Error('NOT_FOUND')
    notFoundError.code = 5

    const mockCloudIdentityClient = {
      getDlpRule: async () => {
        throw notFoundError
      },
      deleteDlpRulePreValidated: async () => ({}),
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({ policyName: 'policies/akabc123' }, mockContext)

    assert.ok(result.isError, 'result should be an error response')
    assert.ok(result.content[0].text.includes('Rule not found'), 'error text should mention rule not found')
    assert.ok(result.content[0].text.includes('policies/akabc123'), 'error text should include the policy name')
  })

  test('When getDlpRule throws a transient error, then the response contains the original error message', async () => {
    const transientError = new Error('Service Unavailable')
    transientError.response = { status: 503 }

    const mockCloudIdentityClient = {
      getDlpRule: async () => {
        throw transientError
      },
      deleteDlpRulePreValidated: async () => ({}),
    }

    const handler = getHandler(mockCloudIdentityClient)
    const result = await handler({ policyName: 'policies/akabc123' }, mockContext)

    assert.ok(result.isError, 'result should be an error response')
    assert.ok(
      result.content[0].text.includes('Service Unavailable'),
      'error text should include the original error message',
    )
  })
})
