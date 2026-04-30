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
import {
  webOauthFlowCredential,
  inMemoryStorage,
  VERTEX_AGENT_ENGINE_REDIRECT_URI,
} from '../../lib/util/credential/web_oauth_flow.js'

/**
 * Builds a stub OAuth2Client whose generateAuthUrl returns a recordable URL
 * and whose getToken returns the supplied tokens.
 * @param {object} [opts] Stub options.
 * @param {object} [opts.tokenResponse] Token object getToken returns.
 * @returns {{factory: function, calls: object}} Stub factory and calls record.
 */
function stubOAuth2ClientFactory({ tokenResponse } = {}) {
  const calls = { ctor: [], generateAuthUrl: [], getToken: [], setCredentials: [] }
  function factory(cfg) {
    calls.ctor.push(cfg)
    return {
      generateAuthUrl(params) {
        calls.generateAuthUrl.push(params)
        const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        u.searchParams.set('client_id', cfg.clientId || '')
        u.searchParams.set('redirect_uri', cfg.redirectUri || '')
        u.searchParams.set('scope', (params.scope || []).join(' '))
        if (params.state) u.searchParams.set('state', params.state)
        return u.toString()
      },
      async getToken(code) {
        calls.getToken.push(code)
        return { tokens: tokenResponse || { access_token: 'a', expiry_date: Date.now() + 3600_000, scope: 'x' } }
      },
      setCredentials(t) {
        calls.setCredentials.push(t)
      },
    }
  }
  return { factory, calls }
}

describe('webOauthFlowCredential', () => {
  it('When no tokens are stored, then probe returns ok:false with scopesKnown:false', async () => {
    const cred = webOauthFlowCredential({ clientId: 'c', clientSecret: 's' })
    const probe = await cred.probe()
    assert.equal(probe.ok, false)
    assert.equal(probe.scopesKnown, false)
    assert.equal(probe.source, 'web-oauth-flow')
  })

  it('When tokens are stored with all required scopes and not expired, then probe returns ok:true', async () => {
    const storage = inMemoryStorage()
    await storage.set({ access_token: 'a', expiry_date: Date.now() + 3600_000, scope: 'a b c' })
    const cred = webOauthFlowCredential({ clientId: 'c', clientSecret: 's', requiredScopes: ['a', 'b'], storage })
    const probe = await cred.probe()
    assert.equal(probe.ok, true)
    assert.equal(probe.scopesKnown, true)
    assert.equal(probe.missingScopes.length, 0)
  })

  it('When tokens are stored but expired, then probe returns ok:false with the expiry', async () => {
    const storage = inMemoryStorage()
    await storage.set({ access_token: 'a', expiry_date: Date.now() - 1000, scope: 'a b' })
    const cred = webOauthFlowCredential({ clientId: 'c', clientSecret: 's', requiredScopes: ['a', 'b'], storage })
    const probe = await cred.probe()
    assert.equal(probe.ok, false)
    assert.ok(probe.expiry instanceof Date)
  })

  it('When generateConsentUrl is called, then it produces a URL with the Vertex AI redirect by default', () => {
    const { factory, calls } = stubOAuth2ClientFactory()
    const cred = webOauthFlowCredential({
      clientId: 'c',
      clientSecret: 's',
      requiredScopes: ['a', 'b'],
      createOAuth2Client: factory,
    })
    const url = cred.generateConsentUrl('s123')
    assert.equal(calls.ctor[0].redirectUri, VERTEX_AGENT_ENGINE_REDIRECT_URI)
    assert.deepEqual(calls.generateAuthUrl[0].scope, ['a', 'b'])
    assert.equal(calls.generateAuthUrl[0].access_type, 'online')
    assert.equal(calls.generateAuthUrl[0].state, 's123')
    assert.ok(url.includes('https://accounts.google.com/'))
  })

  it('When a custom redirectUri is passed, then generateConsentUrl uses it', () => {
    const { factory, calls } = stubOAuth2ClientFactory()
    const cred = webOauthFlowCredential({
      clientId: 'c',
      clientSecret: 's',
      redirectUri: 'https://my-runtime.example/oauth-callback',
      requiredScopes: ['a'],
      createOAuth2Client: factory,
    })
    cred.generateConsentUrl()
    assert.equal(calls.ctor[0].redirectUri, 'https://my-runtime.example/oauth-callback')
  })

  it('When exchangeCode is called, then it strips refresh_token and stores the rest', async () => {
    const storage = inMemoryStorage()
    const { factory } = stubOAuth2ClientFactory({
      tokenResponse: {
        access_token: 'access-1',
        refresh_token: 'must-not-persist',
        expiry_date: 12345,
        scope: 'a b',
      },
    })
    const cred = webOauthFlowCredential({
      clientId: 'c',
      clientSecret: 's',
      storage,
      createOAuth2Client: factory,
    })
    const result = await cred.exchangeCode('auth-code-xyz')
    assert.equal(result.access_token, 'access-1')
    assert.equal(result.refresh_token, undefined, 'refresh_token must be stripped from the return value')
    const stored = await storage.get()
    assert.equal(stored.refresh_token, undefined, 'refresh_token must not be persisted')
    assert.equal(stored.access_token, 'access-1')
  })

  it('When tokens are stored, then getClient returns an OAuth2Client with credentials set', async () => {
    const storage = inMemoryStorage()
    await storage.set({ access_token: 'a', expiry_date: Date.now() + 3600_000, scope: 'x' })
    const { factory, calls } = stubOAuth2ClientFactory()
    const cred = webOauthFlowCredential({
      clientId: 'c',
      clientSecret: 's',
      storage,
      createOAuth2Client: factory,
    })
    await cred.getClient()
    assert.equal(calls.setCredentials.length, 1)
    assert.equal(calls.setCredentials[0].access_token, 'a')
  })

  it('When no tokens are stored and getClient is called, then it throws a clear error', async () => {
    const cred = webOauthFlowCredential({ clientId: 'c', clientSecret: 's' })
    await assert.rejects(() => cred.getClient(), err => err.message.includes('No web-OAuth tokens'))
  })
})
