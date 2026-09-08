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

import { describe, test, mock } from 'node:test'
import assert from 'node:assert/strict'
import esmock from 'esmock'

describe('ComputeClient', () => {
  test('When listFirewalls is called, then it queries compute.firewalls.list with project and options', async () => {
    const mockList = mock.fn(async () => ({ data: { items: [{ name: 'allow-gateway' }] } }))
    const mockCompute = {
      firewalls: {
        list: mockList,
      },
    }

    const { ComputeClient } = await esmock('../../lib/api/compute_client.js', {
      '../../lib/util/api-client.js': {
        createApiClient: async () => mockCompute,
      },
      '../../lib/util/helpers.js': {
        callWithRetry: async fn => fn(),
        handleApiError: err => {
          throw err
        },
      },
    })

    const client = new ComputeClient()
    const result = await client.listFirewalls('my-project-123', { filter: 'name = allow-gateway' }, 'mock-token')

    assert.strictEqual(mockList.mock.callCount(), 1)
    const callArgs = mockList.mock.calls[0].arguments[0]
    assert.deepStrictEqual(callArgs, { project: 'my-project-123', filter: 'name = allow-gateway' })
    assert.deepStrictEqual(result, { items: [{ name: 'allow-gateway' }] })
  })
})
