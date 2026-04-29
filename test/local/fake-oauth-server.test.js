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
import { startFakeOAuthServer } from '../helpers/fake-oauth-server.js'

describe('fakeOAuthServer', () => {
  it('When the server starts, then it binds to a random localhost port', async () => {
    const server = await startFakeOAuthServer()
    try {
      assert.match(server.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/)
    } finally {
      await server.stop()
    }
  })

  it('When /token is called with a valid code, then it returns access + refresh tokens', async () => {
    const server = await startFakeOAuthServer()
    try {
      // First, hit /authorize to get a code via redirect.
      const redirectRes = await fetch(
        `${server.authorizeUrl}?redirect_uri=http://127.0.0.1:9999/&scope=test&state=xyz`,
        { redirect: 'manual' },
      )
      const location = redirectRes.headers.get('location')
      const code = new URL(location).searchParams.get('code')
      // Now exchange the code.
      const tokenRes = await fetch(server.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `code=${code}&grant_type=authorization_code`,
      })
      const tokens = await tokenRes.json()
      assert.ok(tokens.access_token)
      assert.ok(tokens.refresh_token)
      assert.equal(tokens.token_type, 'Bearer')
    } finally {
      await server.stop()
    }
  })

  it('When /token is called with an unknown code, then it returns 400 invalid_grant', async () => {
    const server = await startFakeOAuthServer()
    try {
      const res = await fetch(server.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'code=unknown&grant_type=authorization_code',
      })
      assert.equal(res.status, 400)
      const body = await res.json()
      assert.equal(body.error, 'invalid_grant')
    } finally {
      await server.stop()
    }
  })

  it('When /certs is called, then it returns a JWK set with the test key', async () => {
    const server = await startFakeOAuthServer()
    try {
      const res = await fetch(server.certsUrl)
      const json = await res.json()
      assert.ok(Array.isArray(json.keys))
      assert.equal(json.keys[0].kid, 'test-key')
    } finally {
      await server.stop()
    }
  })

  it('When signIdToken is called, then it returns a JWT signed with the test key', async () => {
    const server = await startFakeOAuthServer()
    try {
      const token = await server.signIdToken({ email: 'tim@example.com', aud: 'test-audience' })
      assert.equal(token.split('.').length, 3)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
      assert.equal(payload.email, 'tim@example.com')
      assert.equal(payload.aud, 'test-audience')
    } finally {
      await server.stop()
    }
  })
})
