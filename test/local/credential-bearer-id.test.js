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
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose'
import { bearerCredential } from '../../lib/util/credential/bearer.js'

/**
 * Generate a real RSA key pair and return helpers for signing tokens and
 * building a local JWK set for use as the `jwks` option.
 */
async function makeKeyPairFixture() {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey)
  jwk.kid = 'test-key-1'
  jwk.alg = 'RS256'
  const localJwks = createLocalJWKSet({ keys: [jwk] })

  async function signToken(payload, opts = {}) {
    const builder = new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('https://accounts.google.com')
    if (opts.audience !== undefined) {
      builder.setAudience(opts.audience)
    }
    return builder.sign(opts.privateKey ?? privateKey)
  }

  return { privateKey, publicKey, localJwks, signToken }
}

describe('bearerCredential — ID-token branch', () => {
  describe('getClient', () => {
    it('When the token has a tampered signature, then getClient rejects with the signature-failure message', async () => {
      const { signToken, localJwks } = await makeKeyPairFixture()
      const valid = await signToken({ email: 'user@example.com' }, { audience: 'https://myserver.example.com' })

      // Corrupt the signature segment.
      const parts = valid.split('.')
      parts[2] = parts[2].split('').reverse().join('')
      const tampered = parts.join('.')

      const cred = bearerCredential(tampered, {
        requestHost: 'myserver.example.com',
        jwks: localJwks,
      })

      await assert.rejects(
        () => cred.getClient(),
        err =>
          err.message ===
          "Bearer is an OIDC ID token, but the signature does not verify against Google's public keys. Reject as unauthenticated.",
      )
    })

    it('When the audience claim does not match the request host, then getClient rejects with the audience-mismatch message', async () => {
      const { signToken, localJwks } = await makeKeyPairFixture()
      // Token issued for a different service.
      const token = await signToken({ email: 'user@example.com' }, { audience: 'https://other-service.example.com' })

      const cred = bearerCredential(token, {
        requestHost: 'myserver.example.com',
        jwks: localJwks,
      })

      await assert.rejects(
        () => cred.getClient(),
        err =>
          err.message ===
          'ID token audience does not match this server. Verify the client is calling the correct service URL.',
      )
    })

    it('When JWT.authorize fails, then getClient rejects with the DWD-configuration message', async () => {
      const { signToken, localJwks } = await makeKeyPairFixture()
      const token = await signToken({ email: 'user@example.com' }, { audience: 'https://myserver.example.com' })

      // Stub JWT.prototype.authorize to simulate a missing DWD configuration.
      const { JWT } = await import('google-auth-library')
      const origAuthorize = JWT.prototype.authorize
      JWT.prototype.authorize = async function () {
        throw new Error('access_denied')
      }

      try {
        const cred = bearerCredential(token, {
          requestHost: 'myserver.example.com',
          jwks: localJwks,
        })

        await assert.rejects(
          () => cred.getClient(),
          err =>
            err.message ===
            "Server cannot impersonate the requesting user. Configure domain-wide delegation for the server's service account in the Workspace Admin Console with the scopes from lib/constants.js#SCOPES.",
        )
      } finally {
        JWT.prototype.authorize = origAuthorize
      }
    })

    it('When signature and DWD both succeed, then getClient returns a JWT instance', async () => {
      const { signToken, localJwks } = await makeKeyPairFixture()
      const token = await signToken({ email: 'user@example.com' }, { audience: 'https://myserver.example.com' })

      const { JWT } = await import('google-auth-library')
      const origAuthorize = JWT.prototype.authorize
      JWT.prototype.authorize = async function () {
        this.credentials = { access_token: 'impersonated-token' }
      }

      try {
        const cred = bearerCredential(token, {
          requestHost: 'myserver.example.com',
          jwks: localJwks,
        })

        const client = await cred.getClient()
        assert.ok(client instanceof JWT, `Expected JWT instance, got ${client.constructor.name}`)
      } finally {
        JWT.prototype.authorize = origAuthorize
      }
    })
  })

  describe('probe', () => {
    it('When the token is an ID token, then probe returns ok:true with source:bearer-id', async () => {
      const { signToken } = await makeKeyPairFixture()
      const token = await signToken({ email: 'user@example.com' }, { audience: 'https://myserver.example.com' })

      const cred = bearerCredential(token, { requestHost: 'myserver.example.com' })
      const probe = await cred.probe()

      assert.equal(probe.ok, true)
      assert.equal(probe.source, 'bearer-id')
      assert.equal(probe.scopesKnown, false)
    })
  })
})
