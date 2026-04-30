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
import { JwkCache } from '../../lib/util/credential/jwk_cache.js'

describe('JwkCache', () => {
  it('When jwks is read, then it returns a function (jose RemoteJWKSet)', () => {
    const cache = new JwkCache('https://example.test/certs')
    const jwks = cache.jwks
    assert.equal(typeof jwks, 'function')
  })

  it('When jwks is read multiple times, then the same memoised instance returns each time', () => {
    const cache = new JwkCache('https://example.test/certs')
    const a = cache.jwks
    const b = cache.jwks
    assert.equal(a, b)
  })

  it('When two JwkCache instances exist, then each holds its own memoised RemoteJWKSet', () => {
    const cache1 = new JwkCache('https://example.test/certs')
    const cache2 = new JwkCache('https://example.test/certs')
    assert.notEqual(cache1.jwks, cache2.jwks)
  })
})
