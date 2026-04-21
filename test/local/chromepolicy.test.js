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
import { describe, test, mock } from 'node:test'
import esmock from 'esmock'

describe('RealChromePolicyClient', () => {
  test('When resolvePolicy is called, then it returns resolved policies from the API', async () => {
    const mockResolve = mock.fn(async () => ({
      data: {
        resolvedPolicies: [{ value: { test: 'value' } }],
      },
    }))

    const { RealChromePolicyClient: MockedClient } = await esmock('../../lib/api/real_chrome_policy_client.js', {
      googleapis: {
        google: {
          chromepolicy: () => ({
            customers: {
              policies: {
                resolve: mockResolve,
              },
            },
          }),
        },
      },
    })

    const client = new MockedClient()
    const result = await client.resolvePolicy('C0123', 'OU456', 'some.filter')

    assert.strictEqual(mockResolve.mock.callCount(), 1)
    assert.deepStrictEqual(result, [{ value: { test: 'value' } }])

    const args = mockResolve.mock.calls[0].arguments[0]
    assert.strictEqual(args.customer, 'customers/C0123')
    assert.strictEqual(args.requestBody.policyTargetKey.targetResource, 'orgunits/OU456')
  })

  test('When resolvePolicy encounters a 404, then it returns an empty array instead of throwing', async () => {
    const mockResolve = mock.fn(async () => {
      const error = new Error('Not Found')
      error.status = 404
      throw error
    })

    const { RealChromePolicyClient: MockedClient } = await esmock('../../lib/api/real_chrome_policy_client.js', {
      googleapis: {
        google: {
          chromepolicy: () => ({
            customers: {
              policies: {
                resolve: mockResolve,
              },
            },
          }),
        },
      },
    })

    const client = new MockedClient()
    const result = await client.resolvePolicy('C0123', 'OU456', 'some.filter')

    assert.deepStrictEqual(result, [])
  })

  test('When batchModifyPolicy is called, then it sends requests to the API', async () => {
    const mockBatchModify = mock.fn(async () => ({
      data: { status: 'success' },
    }))

    const { RealChromePolicyClient: MockedClient } = await esmock('../../lib/api/real_chrome_policy_client.js', {
      googleapis: {
        google: {
          chromepolicy: () => ({
            customers: {
              policies: {
                orgunits: {
                  batchModify: mockBatchModify,
                },
              },
            },
          }),
        },
      },
    })

    const client = new MockedClient()
    const requests = [{ policyValue: { test: 'value' } }]
    const result = await client.batchModifyPolicy('C0123', 'OU456', requests)

    assert.strictEqual(mockBatchModify.mock.callCount(), 1)
    assert.deepStrictEqual(result, { status: 'success' })

    const args = mockBatchModify.mock.calls[0].arguments[0]
    assert.strictEqual(args.customer, 'customers/C0123')
    assert.deepStrictEqual(args.requestBody.requests, requests)
  })
})
