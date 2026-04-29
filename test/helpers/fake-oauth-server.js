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
 * @file Minimal fake OAuth issuer for end-to-end tests of the managed OAuth flow.
 */

import express from 'express'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'

/**
 * Starts a fake OAuth issuer on a random port. Returns config including the
 * authorize/token URLs, the JWK set URL, a stop function, and helpers to
 * generate test tokens.
 * @returns {Promise<object>}
 */
export async function startFakeOAuthServer() {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }

  const issuedTokens = new Map() // code → { access_token, refresh_token, scope }

  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.use(express.json())

  app.get('/authorize', (req, res) => {
    // Loopback-style redirect: the test typically calls this directly with code in the URL.
    const code = 'test-auth-code-' + Math.random().toString(36).slice(2)
    issuedTokens.set(code, { scope: req.query.scope || '' })
    const redirectUri = req.query.redirect_uri
    res.redirect(`${redirectUri}?code=${code}&state=${req.query.state || ''}`)
  })

  app.post('/token', (req, res) => {
    const { code, grant_type } = req.body
    if (grant_type === 'refresh_token') {
      // Return a refreshed access token.
      res.json({
        access_token: 'refreshed-' + Math.random().toString(36).slice(2),
        expires_in: 3600,
        token_type: 'Bearer',
      })
      return
    }
    const session = issuedTokens.get(code)
    if (!session) {
      res.status(400).json({ error: 'invalid_grant' })
      return
    }
    res.json({
      access_token: 'access-' + Math.random().toString(36).slice(2),
      refresh_token: 'refresh-' + Math.random().toString(36).slice(2),
      expires_in: 3600,
      token_type: 'Bearer',
      scope: session.scope,
    })
  })

  app.post('/revoke', (req, res) => {
    res.status(200).end()
  })

  app.get('/certs', (req, res) => {
    res.set('cache-control', 'max-age=3600').json({ keys: [jwk] })
  })

  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => {
    server.on('listening', resolve)
  })
  const port = server.address().port
  const baseUrl = `http://127.0.0.1:${port}`

  return {
    baseUrl,
    authorizeUrl: `${baseUrl}/authorize`,
    tokenUrl: `${baseUrl}/token`,
    revokeUrl: `${baseUrl}/revoke`,
    certsUrl: `${baseUrl}/certs`,
    stop: () =>
      new Promise(resolve => {
        server.close(() => {
          resolve()
        })
      }),
    /**
     * Issues a signed JWT for testing the ID-token branch.
     * @param {object} claims - JWT claims object
     * @returns {Promise<string>} signed JWT
     */
    async signIdToken(claims) {
      return new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuedAt()
        .setIssuer('https://accounts.google.com')
        .setExpirationTime('1h')
        .sign(privateKey)
    },
  }
}
