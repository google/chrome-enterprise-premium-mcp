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

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { bearerCredential } from '../../lib/util/credential/bearer.js'

describe('bearerCredential', () => {
  describe('probe', () => {
    it('When the factory is constructed with any token, then probe returns ok:true with source:bearer-access and scopesKnown:false', async () => {
      const cred = bearerCredential('any-token-value')
      const probe = await cred.probe()
      assert.equal(probe.ok, true)
      assert.equal(probe.source, 'bearer-access')
      assert.equal(probe.scopesKnown, false)
      assert.equal(probe.principal, null)
    })
  })

  describe('getClient', () => {
    it('When getClient is called, then it returns an OAuth2Client with the bearer set as access_token', async () => {
      const cred = bearerCredential('the-token')
      const client = await cred.getClient()
      assert.equal(client.constructor.name, 'OAuth2Client')
      assert.equal(client.credentials.access_token, 'the-token')
    })
  })

  describe('buildRemediation', () => {
    it('When called, then it returns null', () => {
      const cred = bearerCredential('whatever')
      const probe = {
        ok: true,
        source: 'bearer-access',
        principal: null,
        credentialType: null,
        scopesKnown: false,
        missingScopes: [],
        expiry: null,
      }
      assert.equal(cred.buildRemediation(probe, []), null)
    })
  })
})
