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

describe('CloudResourceManagerClient', () => {
  test('When searchOrganizations is called, then it calls the googleapi search method', async () => {
    const mockSearch = mock.fn(async () => ({ data: { organizations: [] } }))
    const mockCloudresourcemanager = {
      organizations: {
        search: mockSearch,
      },
    }

    const { CloudResourceManagerClient } = await esmock('../../lib/api/cloud_resource_manager_client.js', {
      '../../lib/util/api-client.js': {
        createApiClient: async () => mockCloudresourcemanager,
      },
      '../../lib/util/helpers.js': {
        callWithRetry: async fn => fn(),
        handleApiError: err => {
          throw err
        },
      },
    })

    const client = new CloudResourceManagerClient()
    const options = { query: 'domain:test.com', pageSize: 10 }
    const result = await client.searchOrganizations(options, 'mock-token')

    assert.strictEqual(mockSearch.mock.callCount(), 1)
    const callArgs = mockSearch.mock.calls[0].arguments[0]
    assert.deepStrictEqual(callArgs.requestBody, options)
    assert.deepStrictEqual(result, { organizations: [] })
  })
})
