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

/**
 * @file End-to-end tests for the managed OAuth loopback flow.
 *
 * Boots a fake OAuth issuer, runs runLoginFlow against it with a stub
 * openBrowser that programmatically hits /authorize, and asserts tokens land
 * in the cache with mode 0600.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { startFakeOAuthServer } from '../helpers/fake-oauth-server.js'
import { oauthFlowCredential } from '../../lib/util/credential/oauth_flow.js'

describe('OAuth flow end-to-end', () => {
  it('When runLoginFlow completes against a fake issuer, then tokens land in the cache with mode 0600', async () => {
    const fake = await startFakeOAuthServer()
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-oauth-e2e-'))
    const cachePath = path.join(cacheDir, 'tokens.json')

    const cred = oauthFlowCredential({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      cachePath,
      requiredScopes: ['scope-a', 'scope-b'],
      authUrl: fake.authorizeUrl,
      tokenUrl: fake.tokenUrl,
    })

    // Stub openBrowser: instead of launching a real browser, call the fake
    // /authorize endpoint directly. The fake redirects to the loopback URI with
    // a code, completing the callback without any human interaction.
    const openBrowser = async url => {
      const u = new URL(url)
      const redirectUri = u.searchParams.get('redirect_uri')
      const state = u.searchParams.get('state') || ''
      const scope = u.searchParams.get('scope') || ''
      await fetch(
        `${fake.authorizeUrl}?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}`,
        { redirect: 'follow' },
      )
    }

    try {
      await cred.runLoginFlow({ openBrowser })

      const stat = await fs.stat(cachePath)
      assert.equal(stat.mode & 0o777, 0o600, 'cache file must have mode 0600')

      const tokens = JSON.parse(await fs.readFile(cachePath, 'utf8'))
      assert.ok(tokens.access_token, 'cache must contain access_token')
      assert.ok(tokens.access_token.startsWith('access-'), 'access_token must come from the fake issuer')
      assert.equal(tokens.refresh_token, undefined, 'cache must not persist refresh_token (policy)')
    } finally {
      await fake.stop()
      await fs.rm(cacheDir, { recursive: true, force: true })
    }
  })

  it('When runLoginFlow has cached tokens, then probe returns ok:true', async () => {
    const fake = await startFakeOAuthServer()
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-oauth-e2e-'))
    const cachePath = path.join(cacheDir, 'tokens.json')

    const cred = oauthFlowCredential({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      cachePath,
      requiredScopes: ['scope-a', 'scope-b'],
      authUrl: fake.authorizeUrl,
      tokenUrl: fake.tokenUrl,
    })

    const openBrowser = async url => {
      const u = new URL(url)
      const redirectUri = u.searchParams.get('redirect_uri')
      const state = u.searchParams.get('state') || ''
      const scope = u.searchParams.get('scope') || ''
      await fetch(
        `${fake.authorizeUrl}?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}`,
        { redirect: 'follow' },
      )
    }

    try {
      await cred.runLoginFlow({ openBrowser })

      const result = await cred.probe()
      assert.equal(result.ok, true, 'probe must return ok:true after a successful login flow')
      assert.equal(result.source, 'oauth-flow')
      assert.deepEqual(result.missingScopes, [], 'probe must report no missing scopes')
    } finally {
      await fake.stop()
      await fs.rm(cacheDir, { recursive: true, force: true })
    }
  })
})
