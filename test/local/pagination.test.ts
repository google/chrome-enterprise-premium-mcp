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
import { AdminSdkClient } from '../../lib/api/admin_sdk_client'

describe('API Pagination Logic', () => {
  test('AdminSdkClient.listOrgUnits should handle pagination', async () => {
    const mockList = mock.fn(async params => {
      if (!params.pageToken) {
        return {
          data: {
            organizationUnits: [{ name: 'OU 1', orgUnitId: 'id:1' }],
            nextPageToken: 'page2',
          },
        }
      } else if (params.pageToken === 'page2') {
        return {
          data: {
            organizationUnits: [{ name: 'OU 2', orgUnitId: 'id:2' }],
          },
        }
      }
      return { data: {} }
    })

    const client = new AdminSdkClient()
    // Inject a mock service getter to avoid esmock complexity
    client.getAdminService = async () => ({
      orgunits: {
        list: mockList,
      },
    })

    const result = await client.listOrgUnits({ customerId: 'C123' }, 'token')

    // This test is EXPECTED TO FAIL until we fix the bug
    assert.strictEqual(mockList.mock.callCount(), 2, 'Should have called API twice due to pagination')
    assert.strictEqual(result.organizationUnits.length, 2, 'Should have aggregated results from all pages')
  })
})
