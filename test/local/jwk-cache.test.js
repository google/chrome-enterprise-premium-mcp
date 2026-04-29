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
  it('When the cache is empty, then getKeys fetches the JWK set', async () => {
    let fetchCalls = 0
    const fakeFetch = async () => {
      fetchCalls++
      return new Response(JSON.stringify({ keys: [{ kid: 'x' }] }), {
        headers: { 'cache-control': 'max-age=3600' },
      })
    }
    const cache = new JwkCache('https://example.test/certs', { fetch: fakeFetch, now: () => 0 })
    await cache.getKeys()
    assert.equal(fetchCalls, 1)
  })

  it('When the cache is fresh, then getKeys does not refetch', async () => {
    let fetchCalls = 0
    const fakeFetch = async () => {
      fetchCalls++
      return new Response(JSON.stringify({ keys: [] }), {
        headers: { 'cache-control': 'max-age=3600' },
      })
    }
    const cache = new JwkCache('https://example.test/certs', { fetch: fakeFetch, now: () => 0 })
    await cache.getKeys()
    await cache.getKeys()
    assert.equal(fetchCalls, 1)
  })

  it('When the cache is past TTL, then getKeys refetches', async () => {
    let fetchCalls = 0
    const fakeFetch = async () => {
      fetchCalls++
      return new Response(JSON.stringify({ keys: [] }), {
        headers: { 'cache-control': 'max-age=10' },
      })
    }
    let now = 0
    const cache = new JwkCache('https://example.test/certs', { fetch: fakeFetch, now: () => now })
    await cache.getKeys()
    now = 11_000
    await cache.getKeys()
    assert.equal(fetchCalls, 2)
  })

  it('When the response has no Cache-Control, then the default TTL of 3600s applies', async () => {
    let fetchCalls = 0
    const fakeFetch = async () => {
      fetchCalls++
      return new Response(JSON.stringify({ keys: [] }), { headers: {} })
    }
    let now = 0
    const cache = new JwkCache('https://example.test/certs', { fetch: fakeFetch, now: () => now })
    await cache.getKeys()
    now = 3_599_000
    await cache.getKeys()
    assert.equal(fetchCalls, 1)
    now = 3_601_000
    await cache.getKeys()
    assert.equal(fetchCalls, 2)
  })
})
