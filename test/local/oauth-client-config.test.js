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
import { resolveOAuthClientConfig, managedClientIsPlaceholder } from '../../lib/util/credential/oauth_client_config.js'
import {
  MANAGED_OAUTH_CLIENT_ID,
  MANAGED_OAUTH_CLIENT_SECRET,
  MANAGED_OAUTH_CLIENT_PLACEHOLDER,
} from '../../lib/constants.js'

describe('managed OAuth client placeholder', () => {
  it('Both managed constants reference the shared TODO placeholder', () => {
    assert.equal(MANAGED_OAUTH_CLIENT_ID, MANAGED_OAUTH_CLIENT_PLACEHOLDER)
    assert.equal(MANAGED_OAUTH_CLIENT_SECRET, MANAGED_OAUTH_CLIENT_PLACEHOLDER)
  })

  it('managedClientIsPlaceholder() returns true while the constants hold the TODO value', () => {
    assert.equal(managedClientIsPlaceholder(), true)
  })
})

describe('resolveOAuthClientConfig', () => {
  it('When neither env var is set and managed client is unprovisioned, then it throws a clear TODO message', () => {
    assert.throws(() => resolveOAuthClientConfig({}), /Managed OAuth client is not yet provisioned/)
  })

  it('When env vars are empty strings (set but blank), then it falls through to the unprovisioned-managed throw', () => {
    assert.throws(
      () => resolveOAuthClientConfig({ CEP_OAUTH_CLIENT_ID: '', CEP_OAUTH_CLIENT_SECRET: '' }),
      /Managed OAuth client is not yet provisioned/,
    )
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
