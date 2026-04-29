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
 * @file End-to-end tests for the four bearer token paths.
 *
 * Each test runs bearerCredential() → getClient() → real HTTP call against the
 * fake API server. The fake OAuth server supplies the JWK set so ID-token
 * signature verification never contacts Google.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { OAuth2Client } from 'google-auth-library'
import { SignJWT, generateKeyPair, exportJWK } from 'jose'
import { bearerCredential } from '../../lib/util/credential/bearer.js'
import { startFakeOAuthServer } from '../helpers/fake-oauth-server.js'
import { startFakeServer } from '../helpers/fake-api-server.js'
import { RealAdminSdkClient } from '../../lib/api/real_admin_sdk_client.js'

/**
 * Wraps an already-resolved auth client in a minimal Credential so it can be
 * passed to RealAdminSdkClient methods, which expect a Credential with getClient().
 * @param {object} authClient A google-auth-library client instance.
 * @returns {{ getClient: () => Promise<object> }}
 */
function resolvedCredential(authClient) {
  return { getClient: async () => authClient }
}

describe('bearer credential — four end-to-end paths', () => {
  let oauthServer
  let apiServer
  let adminSdk

  before(async () => {
    oauthServer = await startFakeOAuthServer()
    apiServer = await startFakeServer()
    adminSdk = new RealAdminSdkClient({ rootUrl: apiServer.url })
  })

  after(async () => {
    await oauthServer.close()
    await apiServer.close()
  })

  it('opaque access token — passes through unchanged; API call succeeds', async () => {
    const token = 'ya29.opaquetoken'
    const cred = bearerCredential(token)
    const client = await cred.getClient()

    assert.ok(client instanceof OAuth2Client, 'Expected OAuth2Client for opaque token')
    assert.equal(client.credentials.access_token, token, 'Token should be stored as-is')

    // The fake API server ignores auth headers, so the call succeeds with any token.
    const customer = await adminSdk.getCustomerId(resolvedCredential(client))
    assert.equal(customer.id, 'C0123456', 'Should receive fake customer ID from API')
  })

  it('signed JWT access token (scope claim) — classified as access; API call succeeds', async () => {
    // Build a JWT with a scope claim so classifyBearer returns 'access'.
    const { privateKey } = await generateKeyPair('RS256')
    const jwtAccessToken = await new SignJWT({
      scope: 'https://www.googleapis.com/auth/admin.directory.customer.readonly',
      sub: 'service-account@project.iam.gserviceaccount.com',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('https://accounts.google.com')
      .sign(privateKey)

    const cred = bearerCredential(jwtAccessToken)
    const client = await cred.getClient()

    assert.ok(client instanceof OAuth2Client, 'JWT with scope claim should produce OAuth2Client')
    assert.equal(client.credentials.access_token, jwtAccessToken, 'JWT should be stored as access token')

    const customer = await adminSdk.getCustomerId(resolvedCredential(client))
    assert.equal(customer.id, 'C0123456', 'Should receive fake customer ID from API')
  })

  it('valid ID token — signature verified; getClient returns injected JWT client; API call succeeds', async () => {
    const idToken = await oauthServer.signIdToken(
      { email: 'user@example.com' },
      { audience: 'https://fake-server.example.com' },
    )

    // Stub a pre-authorized JWT client that carries a known impersonated token.
    const impersonatedToken = 'impersonated-access-token-dwd'
    const stubbedJwtClient = new OAuth2Client()
    stubbedJwtClient.setCredentials({ access_token: impersonatedToken })

    const cred = bearerCredential(idToken, {
      expectedAudience: 'https://fake-server.example.com',
      jwks: oauthServer.jwks,
      jwtClient: stubbedJwtClient,
    })

    const client = await cred.getClient()
    assert.equal(
      client.credentials.access_token,
      impersonatedToken,
      'API client should carry the impersonated token, not the original ID token',
    )

    // The fake API accepts any token; the important assertion is which token arrived.
    const customer = await adminSdk.getCustomerId(resolvedCredential(client))
    assert.equal(customer.id, 'C0123456', 'Should receive fake customer ID from API')
  })

  it('ID token with wrong audience — getClient rejects before the API is called', async () => {
    const idToken = await oauthServer.signIdToken(
      { email: 'user@example.com' },
      { audience: 'https://other-service.example.com' },
    )

    const cred = bearerCredential(idToken, {
      expectedAudience: 'https://fake-server.example.com',
      jwks: oauthServer.jwks,
    })

    await assert.rejects(
      () => cred.getClient(),
      err =>
        err.message === 'ID token audience does not match this server. Verify the client is calling the correct service URL.',
      'Should reject with audience-mismatch message',
    )
  })
})
