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
 * @file JWK fetcher for ID-token verification. Wraps jose's
 * createRemoteJWKSet, which manages TTL caching internally based on the
 * response's Cache-Control header. The wrapper memoises the JWK set
 * instance per JwkCache so jose's cache is shared across calls.
 */

import { createRemoteJWKSet } from 'jose'

export class JwkCache {
  /**
   * Constructs a memoised remote JWK set.
   * @param {string} jwksUrl The JWK set URL (e.g. Google's https://www.googleapis.com/oauth2/v3/certs).
   */
  constructor(jwksUrl) {
    this._url = jwksUrl
    this._jwks = null
  }

  /**
   * Returns a `jose` JWKS object suitable for `jwtVerify`. Memoised: the
   * same RemoteJWKSet instance returns on every access, which preserves
   * jose's internal TTL cache across calls.
   * @returns {ReturnType<typeof createRemoteJWKSet>} A jose RemoteJWKSet.
   */
  get jwks() {
    if (!this._jwks) {
      this._jwks = createRemoteJWKSet(new URL(this._url))
    }
    return this._jwks
  }
}
