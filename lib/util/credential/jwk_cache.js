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
 * @file JWK fetch and cache for ID-token verification.
 */

import { createRemoteJWKSet } from 'jose'

/**
 * Caches a remote JWK set with TTL pulled from the response's Cache-Control header.
 */
export class JwkCache {
  /**
   * Constructs a cache for a remote JWK set.
   * @param {string} jwksUrl The JWK set URL (e.g. Google's https://www.googleapis.com/oauth2/v3/certs).
   * @param {{fetch?: typeof globalThis.fetch, now?: () => number}} [opts] Options for fetch and time override.
   */
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  constructor(jwksUrl, { fetch = globalThis.fetch, now = () => Date.now() } = {}) {
    this._url = jwksUrl
    this._fetch = fetch
    this._now = now
    this._cache = null
    this._expiresAt = 0
  }

  /**
   * Returns the parsed JWK key array, fetching when cold or past TTL.
   * @returns {Promise<object[]>} The JWK keys array.
   */
  async getKeys() {
    if (this._cache && this._now() < this._expiresAt) {
      return this._cache
    }
    const res = await this._fetch(this._url)
    const json = await res.json()
    const cc = res.headers.get('cache-control') || ''
    const match = cc.match(/max-age=(\d+)/)
    const ttlMs = match ? Number(match[1]) * 1000 : 3_600_000
    this._cache = json.keys
    this._expiresAt = this._now() + ttlMs
    return this._cache
  }

  /**
   * Returns a `jose` JWKS object suitable for `jwtVerify`.
   * @returns {ReturnType<typeof createRemoteJWKSet>} A jose RemoteJWKSet.
   */
  get jwks() {
    return createRemoteJWKSet(new URL(this._url))
  }
}
