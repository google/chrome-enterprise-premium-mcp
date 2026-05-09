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
import { adcCredential } from '../../lib/util/credential/adc.js'
import { SCOPES } from '../../lib/constants.js'

describe('adcCredential', () => {
  describe('probe', () => {
    it('When ADC is not configured, then it returns ok:false with source:adc', async () => {
      // Force GoogleAuth to fail by pointing at a nonexistent credential file.
      const origValue = process.env.GOOGLE_APPLICATION_CREDENTIALS
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/nonexistent/path.json'
      try {
        const cred = adcCredential()
        const probe = await cred.probe()
        assert.equal(probe.ok, false)
        assert.equal(probe.source, 'adc')
      } finally {
        if (origValue === undefined) {
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS
        } else {
          // eslint-disable-next-line require-atomic-updates
          process.env.GOOGLE_APPLICATION_CREDENTIALS = origValue
        }
      }
    })

    it('When tokeninfo returns email and a scope subset, then probe reports the missing scopes and the principal', async () => {
      const origFetch = globalThis.fetch
      // Stub fetch so tokeninfo returns two scopes; the rest are "missing".
      globalThis.fetch = async url => {
        if (typeof url === 'string' && url.includes('tokeninfo')) {
          return new Response(
            JSON.stringify({
              email: 'tim@example.com',
              scope: SCOPES.EMAIL + ' ' + SCOPES.CHROME_MANAGEMENT_POLICY,
            }),
            { status: 200 },
          )
        }
        return origFetch(url)
      }

      // Stub GoogleAuth so getClient returns an object with a stubbed getAccessToken.
      const { GoogleAuth } = await import('google-auth-library')
      const origGetClient = GoogleAuth.prototype.getClient
      GoogleAuth.prototype.getClient = async function () {
        return {
          getAccessToken: async () => ({ token: 'fake-token-abc' }),
          email: null,
          quotaProjectId: null,
          constructor: { name: 'FakeClient' },
        }
      }

      try {
        const cred = adcCredential()
        const probe = await cred.probe()
        assert.equal(probe.principal, 'tim@example.com')
        assert.equal(probe.scopesKnown, true)
        assert.ok(probe.missingScopes.length > 0, 'should report scopes beyond the two stubbed ones as missing')
        assert.ok(!probe.missingScopes.includes(SCOPES.EMAIL), 'EMAIL scope should not be missing')
        assert.ok(
          !probe.missingScopes.includes(SCOPES.CHROME_MANAGEMENT_POLICY),
          'CHROME_MANAGEMENT_POLICY scope should not be missing',
        )
      } finally {
        // eslint-disable-next-line require-atomic-updates
        globalThis.fetch = origFetch
        GoogleAuth.prototype.getClient = origGetClient
      }
    })

    it('When tokeninfo returns only one scope, then all other required scopes are reported as missing', async () => {
      const origFetch = globalThis.fetch
      globalThis.fetch = async url => {
        if (typeof url === 'string' && url.includes('tokeninfo')) {
          return new Response(
            JSON.stringify({
              email: 'test@example.com',
              scope: SCOPES.EMAIL,
            }),
            { status: 200 },
          )
        }
        return origFetch(url)
      }

      const { GoogleAuth } = await import('google-auth-library')
      const origGetClient = GoogleAuth.prototype.getClient
      GoogleAuth.prototype.getClient = async function () {
        return {
          getAccessToken: async () => ({ token: 'fake-token' }),
          email: null,
          constructor: { name: 'FakeClient' },
        }
      }

      try {
        const cred = adcCredential()
        const probe = await cred.probe()
        assert.equal(probe.scopesKnown, true)

        // Explicitly verify that critical required scopes are reported as missing
        assert.ok(
          probe.missingScopes.includes(SCOPES.LICENSING),
          `Scope apps.licensing (${SCOPES.LICENSING}) should be reported as missing`,
        )
        assert.ok(
          probe.missingScopes.includes(SCOPES.CHROME_MANAGEMENT_POLICY),
          `Scope chrome.management.policy (${SCOPES.CHROME_MANAGEMENT_POLICY}) should be reported as missing`,
        )

        const expectedMissing = Object.values(SCOPES).filter(s => s !== SCOPES.EMAIL)
        for (const s of expectedMissing) {
          assert.ok(probe.missingScopes.includes(s), `Scope ${s} should be reported as missing`)
        }
        assert.equal(probe.missingScopes.length, expectedMissing.length)
      } finally {
        // eslint-disable-next-line require-atomic-updates
        globalThis.fetch = origFetch
        GoogleAuth.prototype.getClient = origGetClient
      }
    })
  })
})
