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
import { resolveOAuthClientConfig } from '../../lib/util/credential/oauth_client_config.js'
import { MANAGED_OAUTH_CLIENT_ID, MANAGED_OAUTH_CLIENT_SECRET } from '../../lib/constants.js'

describe('managed OAuth client constants', () => {
  it('When the bundled client id is read, then it is a non-empty Google OAuth client id', () => {
    assert.equal(typeof MANAGED_OAUTH_CLIENT_ID, 'string')
    assert.match(MANAGED_OAUTH_CLIENT_ID, /\.apps\.googleusercontent\.com$/)
  })

  it('When the bundled client secret is read, then it is a non-empty string with the GOCSPX prefix', () => {
    assert.equal(typeof MANAGED_OAUTH_CLIENT_SECRET, 'string')
    assert.match(MANAGED_OAUTH_CLIENT_SECRET, /^GOCSPX-/)
  })
})

describe('resolveOAuthClientConfig', () => {
  it('When neither env var is set, then it returns the bundled managed client with source:managed', () => {
    const config = resolveOAuthClientConfig({})
    assert.equal(config.source, 'managed')
    assert.equal(config.clientId, MANAGED_OAUTH_CLIENT_ID)
    assert.equal(config.clientSecret, MANAGED_OAUTH_CLIENT_SECRET)
  })

  it('When both env vars are empty strings, then it returns the bundled managed client with source:managed', () => {
    const config = resolveOAuthClientConfig({ CEP_OAUTH_CLIENT_ID: '', CEP_OAUTH_CLIENT_SECRET: '' })
    assert.equal(config.source, 'managed')
    assert.equal(config.clientId, MANAGED_OAUTH_CLIENT_ID)
    assert.equal(config.clientSecret, MANAGED_OAUTH_CLIENT_SECRET)
  })

  it('When both env vars are set, then it returns the custom values with source:custom', () => {
    const config = resolveOAuthClientConfig({
      CEP_OAUTH_CLIENT_ID: 'custom-id-1234567890',
      CEP_OAUTH_CLIENT_SECRET: 'custom-secret',
    })
    assert.equal(config.source, 'custom')
    assert.equal(config.clientId, 'custom-id-1234567890')
    assert.equal(config.clientSecret, 'custom-secret')
  })

  it('When only CEP_OAUTH_CLIENT_ID is set, then it throws the asymmetric-env message', () => {
    assert.throws(
      () => resolveOAuthClientConfig({ CEP_OAUTH_CLIENT_ID: 'x' }),
      /Set both CEP_OAUTH_CLIENT_ID and CEP_OAUTH_CLIENT_SECRET/,
    )
  })

  it('When only CEP_OAUTH_CLIENT_SECRET is set, then it throws the asymmetric-env message', () => {
    assert.throws(
      () => resolveOAuthClientConfig({ CEP_OAUTH_CLIENT_SECRET: 'x' }),
      /Set both CEP_OAUTH_CLIENT_ID and CEP_OAUTH_CLIENT_SECRET/,
    )
  })
})
