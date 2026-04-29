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
 * @file In-process fake OIDC issuer for integration testing.
 *
 * Provides /certs (JWK set) and signIdToken() so tests can mint RS256-signed
 * JWTs whose signatures verify against the local key pair without contacting
 * Google's servers.
 */

import express from 'express'
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose'

/**
 * Starts the fake OAuth server on a dynamic port.
 *
 * @returns {Promise<{
 *   url: string,
 *   jwks: import('jose').JWTVerifyGetKey,
 *   signIdToken: (claims: object, opts?: { audience?: string, expirationTime?: string }) => Promise<string>,
 *   close: () => Promise<void>
 * }>}
 */
export async function startFakeOAuthServer() {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey)
  jwk.kid = 'fake-key-1'
  jwk.alg = 'RS256'
  jwk.use = 'sig'

  const localJwks = createLocalJWKSet({ keys: [jwk] })

  /**
   * Signs an ID token with the local key pair.
   * @param {object} claims JWT payload claims (must include email for ID-token classification).
   * @param {object} [opts]
   * @param {string} [opts.audience] The `aud` claim; defaults to 'https://fake-server.example.com'.
   * @param {string} [opts.expirationTime] Jose expiration string; defaults to '1h'.
   * @returns {Promise<string>} The signed JWT.
   */
  async function signIdToken(claims, { audience = 'https://fake-server.example.com', expirationTime = '1h' } = {}) {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'fake-key-1' })
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .setIssuer('https://accounts.google.com')
      .setAudience(audience)
      .sign(privateKey)
  }

  const app = express()

  app.get('/certs', (_req, res) => {
    res.json({ keys: [jwk] })
  })

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address()
      const url = `http://localhost:${port}`
      resolve({
        url,
        jwks: localJwks,
        signIdToken,
        close: () =>
          new Promise((res, rej) => {
            if (typeof server.closeAllConnections === 'function') {
              server.closeAllConnections()
            }
            server.close(err => (err ? rej(err) : res()))
          }),
      })
    })
    server.on('error', reject)
  })
}
