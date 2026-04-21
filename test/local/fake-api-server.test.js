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

import { describe, test, before, after } from 'node:test'
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
    test('When customer is requested by ID, then it returns the customer data', async () => {
      const { status, body } = await get('/admin/directory/v1/customers/C0123456')
      assert.strictEqual(status, 200)
      assert.strictEqual(body.id, 'C0123456')
    })

    test('When my_customer alias is used, then it resolves to the default customer ID', async () => {
      const { status, body } = await get('/admin/directory/v1/customers/my_customer')
      assert.strictEqual(status, 200)
      assert.strictEqual(body.id, 'C0123456')
    })

    test('When an unknown customer ID is requested, then it returns a 404 error', async () => {
      const { status } = await get('/admin/directory/v1/customers/UNKNOWN')
      assert.strictEqual(status, 404)
    })

    test('When org units are listed, then it returns an array of organization units', async () => {
      const { status, body } = await get('/admin/directory/v1/customer/C0123456/orgunits?type=ALL_INCLUDING_PARENT')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.organizationUnits))
      assert.strictEqual(body.organizationUnits.length, 2)
    })

    test('When activity reports are requested, then it returns a list of items', async () => {
      const { status, body } = await get('/admin/reports/v1/activity/users/user1@example.com/applications/chrome')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.items))
    })
  })

  describe('Licensing', () => {
    test('When licenses are listed for a product and SKU, then it returns matching items', async () => {
      const { status, body } = await get('/licensing/v1/product/101040/sku/1010400001/user?customerId=C0123456')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.items))
      assert.strictEqual(body.items.length, 1)
    })

    test('When a specific user license is requested, then it returns the license data', async () => {
      const { status, body } = await get('/licensing/v1/product/101040/sku/1010400001/user/user1@example.com')
      assert.strictEqual(status, 200)
      assert.strictEqual(body.userId, 'user1@example.com')
    })

    test('When an unknown user license is requested, then it returns a 404 error', async () => {
      const { status } = await get('/licensing/v1/product/101040/sku/1010400001/user/unknown@example.com')
      assert.strictEqual(status, 404)
    })
  })

  describe('Chrome Management', () => {
    test('When chrome version report is requested, then it returns browser version counts', async () => {
      const { status, body } = await get('/v1/customers/C0123456/reports:countChromeVersions')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.browserVersions))
      assert.strictEqual(body.browserVersions.length, 2)
    })

    test('When customer profiles are listed, then it returns an array of profiles', async () => {
      const { status, body } = await get('/v1/customers/C0123456/profiles')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.chromeBrowserProfiles))
    })
  })

  describe('Chrome Policy', () => {
    test('When policies are resolved for a target, then it returns an array of resolved policies', async () => {
      const { status, body } = await post('/v1/customers/C0123456/policies:resolve', {
        policySchemaFilter: 'chrome.users.OnFileAttachedConnectorPolicy',
        policyTargetKey: { targetResource: 'orgunits/fakeOUId1' },
      })
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.resolvedPolicies))
    })
  })

  describe('Cloud Identity Policies', () => {
    test('When DLP rules are filtered, then it returns only policies matching the rule type', async () => {
      const { status, body } = await get('/v1beta1/policies?filter=setting.type.matches("rule.dlp")')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.policies))
      assert.ok(body.policies.length > 0)
    })

    test('When detectors are filtered, then it returns only policies matching the detector type', async () => {
      const { status, body } = await get('/v1beta1/policies?filter=setting.type.matches("detector")')
      assert.strictEqual(status, 200)
      assert.ok(Array.isArray(body.policies))
      assert.ok(body.policies.length > 0)
    })

    test('When pagination is used with pageSize, then it returns limited results and a next page token', async () => {
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

    test('When a specific policy is requested by name, then it returns the policy data', async () => {
      const { status, body } = await get('/v1beta1/policies/fakeDlpRule1')
      assert.strictEqual(status, 200)
      assert.strictEqual(body.name, 'policies/fakeDlpRule1')
    })

    test('When a nonexistent policy is requested, then it returns a 404 error', async () => {
      const { status } = await get('/v1beta1/policies/nonexistent')
      assert.strictEqual(status, 404)
    })

    test('When a valid DLP rule is posted, then it creates the policy successfully', async () => {
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

    test('When a DLP rule without a display name is posted, then it returns a 400 error', async () => {
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

    test('When a detector is created, then it can be retrieved and subsequently deleted', async () => {
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
    test('When state reset is triggered, then deleted policies are restored to initial values', async () => {
      // Delete a policy
      await del('/v1beta1/policies/fakeDlpRule1')
      const { status: beforeReset } = await get('/v1beta1/policies/fakeDlpRule1')
      assert.strictEqual(beforeReset, 404)

      // Reset
      await post('/test/reset', {})

      // Should exist again
      const { status: afterReset } = await get('/v1beta1/policies/fakeDlpRule1')
      assert.strictEqual(afterReset, 200)
    })
  })
})
