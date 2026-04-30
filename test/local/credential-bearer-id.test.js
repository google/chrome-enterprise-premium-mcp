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
import { JWT } from 'google-auth-library'
import { bearerCredential } from '../../lib/util/credential/bearer.js'

/**
 * Builds a real `JWT` subclass instance whose `authorize` is replaced by the
 * supplied stub and which counts how many times `authorize` was called. The
 * instance still satisfies `instanceof JWT`, so bearer.js's check passes.
 * @param {object} opts Options for the fake.
 * @param {() => Promise<void>} opts.authorize Stub for JWT.authorize.
 * @returns {object} A JWT-typed object with `authorizeCalls` counter and `subject` setter.
 */
function makeFakeJwt({ authorize }) {
  const instance = new JWT({ email: 'sa@project.iam.gserviceaccount.com', key: '-', scopes: ['x'] })
  instance.authorizeCalls = 0
  instance.authorize = async function () {
    instance.authorizeCalls += 1
    return authorize()
  }
  return instance
}

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

    it('When the SA acquirer returns a non-JWT client, then getClient rejects with the not-a-service-account message', async () => {
      const { signToken, localJwks } = await makeKeyPairFixture()
      const token = await signToken({ email: 'user@example.com' }, { audience: 'https://myserver.example.com' })

      const cred = bearerCredential(token, {
        requestHost: 'myserver.example.com',
        jwks: localJwks,
        acquireSaClient: async () => ({ notAJwt: true }),
      })

      await assert.rejects(
        () => cred.getClient(),
        err => err.message.includes("Server's ADC is not a service account"),
      )
    })

    it('When JWT.authorize fails, then getClient rejects with the DWD-configuration message and only after subject was set to the verified email', async () => {
      const { signToken, localJwks } = await makeKeyPairFixture()
      const token = await signToken(
        { email: 'verified-user@example.com' },
        { audience: 'https://myserver.example.com' },
      )

      const fake = makeFakeJwt({
        authorize: async () => {
          throw new Error('access_denied')
        },
      })

      const cred = bearerCredential(token, {
        requestHost: 'myserver.example.com',
        jwks: localJwks,
        acquireSaClient: async () => fake,
      })

      await assert.rejects(
        () => cred.getClient(),
        err => err.message.includes('Server cannot impersonate the requesting user'),
      )
      // Subject must be set BEFORE authorize is called — otherwise impersonation runs as the wrong user.
      assert.equal(fake.subject, 'verified-user@example.com')
      assert.equal(fake.authorizeCalls, 1)
    })

    it('When signature and DWD both succeed, then getClient returns the SA client with subject set to the verified email and authorize called once', async () => {
      const { signToken, localJwks } = await makeKeyPairFixture()
      const token = await signToken(
        { email: 'verified-user@example.com' },
        { audience: 'https://myserver.example.com' },
      )

      const fake = makeFakeJwt({ authorize: async () => {} })

      const cred = bearerCredential(token, {
        requestHost: 'myserver.example.com',
        jwks: localJwks,
        acquireSaClient: async () => fake,
      })

      const client = await cred.getClient()
      assert.equal(client, fake)
      assert.ok(client instanceof JWT)
      assert.equal(fake.subject, 'verified-user@example.com')
      assert.equal(fake.authorizeCalls, 1)
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
