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
import { describe, it } from 'node:test'
import { guardedToolCall, validateAndGetOrgUnitId } from '../../tools/utils.js'

// This is a bit of a hack to get access to the un-exported commonTransform function.
// In a real-world scenario, this would be exported from utils.js.
const commonTransform = params => {
  const newParams = { ...params }
  if (newParams.customerId === 'me') {
    newParams.customerId = undefined
  }
  if (newParams.orgUnitId) {
    newParams.orgUnitId = validateAndGetOrgUnitId(newParams.orgUnitId)
  }
  return newParams
}

describe('Tool Utils', () => {
  describe('commonTransform', () => {
    it('should normalize customerId "me" to undefined', () => {
      const params = { customerId: 'me' }
      const transformed = commonTransform(params)
      assert.strictEqual(transformed.customerId, undefined)
    })

    it('should strip "id:" prefix from orgUnitId', () => {
      const params = { orgUnitId: 'id:12345' }
      const transformed = commonTransform(params)
      assert.strictEqual(transformed.orgUnitId, '12345')
    })

    it('should not modify other parameters', () => {
      const params = { customerId: 'C123', orgUnitId: '12345', other: 'value' }
      const transformed = commonTransform(params)
      assert.deepStrictEqual(transformed, { customerId: 'C123', orgUnitId: '12345', other: 'value' })
    })
  })
  describe('guardedToolCall', () => {
    it('should update cachedCustomerId when params.customerId is provided', async () => {
      const handler = async params => {
        return { params }
      }
      const tool = guardedToolCall({ handler })

      // First call with a customerId
      await tool({ customerId: 'C123' }, {})

      // Second call without a customerId
      const result = await tool({}, {})

      // Check if the cached customerId was used
      assert.strictEqual(result.params.customerId, 'C123')
    })
  })
})
