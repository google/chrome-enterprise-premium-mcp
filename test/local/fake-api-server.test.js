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

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startFakeServer } from '../helpers/fake-api-server.js'

describe('Fake API Server', () => {
  let server

  before(async () => {
    server = await startFakeServer()
  })

  after(async () => {
    await server.close()
  })

  async function get(path) {
    const res = await fetch(`${server.url}${path}`)
    return { status: res.status, body: await res.json() }
  }

  async function post(path, body) {
    const res = await fetch(`${server.url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, body: await res.json() }
  }

  async function del(path) {
    const res = await fetch(`${server.url}${path}`, { method: 'DELETE' })
    return { status: res.status, body: await res.json() }
  }

  describe('Admin SDK', () => {
    it('should get customer by ID', async () => {
      const { status, body } = await get('/admin/directory/v1/customers/C0123456')
      assert.strictEqual(status, 200)
      assert.strictEqual(body.id, 'C0123456')
    })

    it('should resolve my_customer alias', async () => {
      const { status, body } = await get('/admin/directory/v1/customers/my_customer')
      assert.strictEqual(status, 200)
      assert.strictEqual(body.id, 'C0123456')
    })

    it('should return 404 for unknown customer', async () => {
      const { status } = await get('/admin/directory/v1/customers/UNKNOWN')
      assert.strictEqual(status, 404)
    })

    it('should list org units', async () => {
      const { status, body } = await get('/admin/directory/v1/customer/C0123456/orgunits?type=ALL_INCLUDING_PARENT')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.organizationUnits))
      assert.strictEqual(body.organizationUnits.length, 2)
    })

    it('should return activity items', async () => {
      const { status, body } = await get('/admin/reports/v1/activity/users/user1@example.com/applications/chrome')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.items))
    })
  })

  describe('Licensing', () => {
    it('should list licenses', async () => {
      const { status, body } = await get('/licensing/v1/product/101040/sku/1010400001/user?customerId=C0123456')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.items))
      assert.strictEqual(body.items.length, 1)
    })

    it('should get user license by userId', async () => {
      const { status, body } = await get('/licensing/v1/product/101040/sku/1010400001/user/user1@example.com')
      assert.strictEqual(status, 200)
      assert.strictEqual(body.userId, 'user1@example.com')
    })

    it('should return 404 for unknown user license', async () => {
      const { status } = await get('/licensing/v1/product/101040/sku/1010400001/user/unknown@example.com')
      assert.strictEqual(status, 404)
    })
  })

  describe('Chrome Management', () => {
    it('should count browser versions', async () => {
      const { status, body } = await get('/v1/customers/C0123456/reports:countChromeVersions')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.browserVersions))
      assert.strictEqual(body.browserVersions.length, 2)
    })

    it('should list profiles', async () => {
      const { status, body } = await get('/v1/customers/C0123456/profiles')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.chromeBrowserProfiles))
    })
  })

  describe('Chrome Policy', () => {
    it('should resolve policies', async () => {
      const { status, body } = await post('/v1/customers/C0123456/policies:resolve', {
        policySchemaFilter: 'chrome.users.OnFileAttachedConnectorPolicy',
        policyTargetKey: { targetResource: 'orgunits/fakeOUId1' },
      })
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.resolvedPolicies))
    })
  })

  describe('Cloud Identity Policies', () => {
    it('should list DLP rules', async () => {
      const { status, body } = await get('/v1beta1/policies?filter=setting.type.matches("rule.dlp")')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.policies))
      assert.ok(body.policies.length > 0)
    })

    it('should list detectors', async () => {
      const { status, body } = await get('/v1beta1/policies?filter=setting.type.matches("detector")')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.policies))
      assert.ok(body.policies.length > 0)
    })

    it('should handle pagination with pageSize and pageToken', async () => {
      // First page
      const { status: status1, body: body1 } = await get('/v1beta1/policies?pageSize=2')
      assert.strictEqual(status1, 200)
      assert.ok(Array.isArray(body1.policies))
      assert.strictEqual(body1.policies.length, 2)
      assert.ok(body1.nextPageToken)

      // Second page
      const { status: status2, body: body2 } = await get(
        '/v1beta1/policies?pageSize=2&pageToken=' + body1.nextPageToken,
      )
      assert.strictEqual(status2, 200)
      assert.ok(Array.isArray(body2.policies))
      assert.strictEqual(body2.policies.length, 2)

      // Verify pages are distinct
      assert.notStrictEqual(body1.policies[0].name, body2.policies[0].name)
    })

    it('should get policy by name', async () => {
      const { status, body } = await get('/v1beta1/policies/fakeDlpRule1')
      assert.strictEqual(status, 200)
      assert.strictEqual(body.name, 'policies/fakeDlpRule1')
    })

    it('should return 404 for unknown policy', async () => {
      const { status } = await get('/v1beta1/policies/nonexistent')
      assert.strictEqual(status, 404)
    })

    it('should create a DLP rule', async () => {
      const { status, body } = await post('/v1beta1/customers/C0123456/policies', {
        setting: {
          type: 'settings/rule.dlp',
          value: {
            displayName: '🤖 Test Rule',
            triggers: ['google.workspace.chrome.file.v1.upload'],
            action: { chromeAction: { warnUser: {} } },
          },
        },
        policyQuery: { orgUnit: 'orgUnits/fakeOUId1' },
      })
      assert.strictEqual(status, 200)
      assert.ok(body.done)
      assert.ok(body.response.name.startsWith('policies/'))
    })

    it('should reject DLP rule without display name', async () => {
      const { status } = await post('/v1beta1/customers/C0123456/policies', {
        setting: {
          type: 'settings/rule.dlp',
          value: {
            triggers: ['google.workspace.chrome.file.v1.upload'],
            action: { chromeAction: { warnUser: {} } },
          },
        },
        policyQuery: { orgUnit: 'orgUnits/fakeOUId1' },
      })
      assert.strictEqual(status, 400)
    })

    it('should create and delete a detector', async () => {
      const createRes = await post('/v1beta1/customers/C0123456/policies', {
        setting: {
          type: 'settings/detector.url_list',
          value: {
            displayName: 'Test Detector',
            url_list: { urls: ['test.com'] },
          },
        },
      })
      assert.strictEqual(createRes.status, 200)
      const name = createRes.body.response.name

      // Verify it exists
      const getRes = await get(`/v1beta1/${name}`)
      assert.strictEqual(getRes.status, 200)

      // Delete it
      const delRes = await del(`/v1beta1/${name}`)
      assert.strictEqual(delRes.status, 200)

      // Verify it's gone
      const getRes2 = await get(`/v1beta1/${name}`)
      assert.strictEqual(getRes2.status, 404)
    })
  })

  describe('State Reset', () => {
    it('should reset state to initial values', async () => {
      // Delete a policy
      await del('/v1beta1/policies/fakeDlpRule1')
      const { status: before } = await get('/v1beta1/policies/fakeDlpRule1')
      assert.strictEqual(before, 404)

      // Reset
      await post('/test/reset', {})

      // Should exist again
      const { status: after } = await get('/v1beta1/policies/fakeDlpRule1')
      assert.strictEqual(after, 200)
    })
  })
})
