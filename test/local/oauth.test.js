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

import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import esmock from 'esmock'

describe('OAuth Middleware', () => {
  let oauthMiddleware
  let verifyTokenMock
  let nextCalled

  beforeEach(async () => {
    nextCalled = false
    verifyTokenMock = async () => {}

    const oauthModule = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        OAuth2Client: class {
          async getTokenInfo(token) {
            await verifyTokenMock(token)
            return { aud: process.env.GOOGLE_OAUTH_AUDIENCE }
          }
        },
      },
    })
    oauthMiddleware = oauthModule.oauthMiddleware
  })

  afterEach(() => {
    delete process.env.OAUTH_ENABLED
    delete process.env.GOOGLE_OAUTH_AUDIENCE
  })

  it('should skip if OAUTH_ENABLED is not true', async () => {
    process.env.OAUTH_ENABLED = 'false'
    const req = { body: { method: 'tools/call' } }
    const res = {}
    const next = () => {
      nextCalled = true
    }

    await oauthMiddleware(req, res, next)
    assert.strictEqual(nextCalled, true)
  })

  it('should skip if method is not tools/call', async () => {
    process.env.OAUTH_ENABLED = 'true'
    const req = { body: { method: 'tools/list' } }
    const res = {}
    const next = () => {
      nextCalled = true
    }

    await oauthMiddleware(req, res, next)
    assert.strictEqual(nextCalled, true)
  })

  it('should return 401 if Authorization header is missing', async () => {
    process.env.OAUTH_ENABLED = 'true'
    const req = { body: { method: 'tools/call' }, headers: {} }
    let statusSet = 0
    let jsonSent = null
    const res = {
      status: s => {
        statusSet = s
        return res
      },
      json: j => {
        jsonSent = j
      },
    }
    const next = () => {
      nextCalled = true
    }

    await oauthMiddleware(req, res, next)
    assert.strictEqual(statusSet, 401)
    assert.strictEqual(jsonSent.error.code, -32001)
    assert.strictEqual(nextCalled, false)
  })

  it('should return 401 if token is invalid', async () => {
    process.env.OAUTH_ENABLED = 'true'
    const req = {
      body: { method: 'tools/call' },
      headers: { authorization: 'Bearer invalid-token' },
    }
    verifyTokenMock = async () => {
      throw new Error('Invalid token')
    }

    let statusSet = 0
    let jsonSent = null
    const res = {
      status: s => {
        statusSet = s
        return res
      },
      json: j => {
        jsonSent = j
      },
    }
    const next = () => {
      nextCalled = true
    }

    await oauthMiddleware(req, res, next)
    assert.strictEqual(statusSet, 401)
    assert.strictEqual(jsonSent.error.message, 'Invalid or expired token.')
    assert.strictEqual(nextCalled, false)
  })

  it('should call next if token is valid', async () => {
    process.env.OAUTH_ENABLED = 'true'
    const req = {
      body: { method: 'tools/call' },
      headers: { authorization: 'Bearer valid-token' },
    }
    const next = () => {
      nextCalled = true
    }
    const res = {}

    await oauthMiddleware(req, res, next)
    assert.strictEqual(nextCalled, true)
  })
})
