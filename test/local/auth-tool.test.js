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
import { describe, test, mock, beforeEach } from 'node:test'
import esmock from 'esmock'

async function loadToolWithMocks({ startToolAuth, completeToolAuth }) {
  return esmock('../../tools/definitions/auth.js', {
    '../../lib/util/credential/auth_login.js': {
      startToolAuth,
      completeToolAuth,
    },
  })
}

/* Snapshot the given env-var keys, set the new values (undefined deletes), run fn, then restore. */
async function withClientEnv(vars, fn) {
  const snapshot = {}
  for (const key of Object.keys(vars)) {
    snapshot[key] = process.env[key]
    const value = vars[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  try {
    await fn()
  } finally {
    for (const key of Object.keys(snapshot)) {
      const original = snapshot[key]
      if (original === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = original
      }
    }
  }
}

describe('cep_auth Tool', () => {
  let server
  let handler

  beforeEach(() => {
    server = { registerTool: mock.fn() }
    handler = null
  })

  async function register(mocks) {
    const { registerAuthTool } = await loadToolWithMocks(mocks)
    registerAuthTool(server)
    const call = server.registerTool.mock.calls.find(c => c.arguments[0] === 'cep_auth')
    assert.ok(call, 'cep_auth was not registered')
    handler = call.arguments[2]
  }

  test('When cep_auth is invoked and the loopback callback completes during the wait, then it returns status=completed', async () => {
    const future = new Date(Date.now() + 3_600_000)
    const startToolAuth = mock.fn(async () => ({
      status: 'completed',
      source: 'managed',
      expiresAt: future,
    }))
    const completeToolAuth = mock.fn()
    await register({ startToolAuth, completeToolAuth })

    const result = await handler({}, {})

    assert.strictEqual(result.isError, undefined)
    assert.strictEqual(result.structuredContent.status, 'completed')
    assert.strictEqual(result.structuredContent.expiresAt, future.toISOString())
    assert.match(result.content[0].text, /Signed in/)
    assert.strictEqual(startToolAuth.mock.callCount(), 1)
    assert.strictEqual(completeToolAuth.mock.callCount(), 0)
  })

  test('When cep_auth is invoked and the wait window expires with terminal hyperlink support, then it returns status=awaiting with OSC 8 hyperlink and plain URL', async () => {
    process.env.FORCE_HYPERLINK = '1'
    try {
      const startToolAuth = mock.fn(async () => ({
        status: 'awaiting',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC',
        browserAttempted: false,
        browserOpened: false,
        expiresAt: new Date(Date.now() + 300_000),
        source: 'managed',
      }))
      const completeToolAuth = mock.fn()
      await register({ startToolAuth, completeToolAuth })

      const result = await handler({}, {})

      assert.strictEqual(result.structuredContent.status, 'awaiting')
      assert.strictEqual(result.structuredContent.nextAction, 'paste-redirect-url')
      assert.strictEqual(result.structuredContent.authUrl, 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC')
      assert.ok(result.structuredContent.agentHint?.length > 0)
      assert.match(result.content[0].text, /Open this URL/)
      assert.match(result.content[0].text, /accounts\.google\.com/)

      const lines = result.content[0].text.split('\n')
      const plainUrlIndex = lines.findIndex(l => l === 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC')
      assert.ok(plainUrlIndex > 0, 'plainUrl should appear in the text block')
      assert.strictEqual(lines[plainUrlIndex - 1], '', 'plainUrl should have a blank line above it')
      assert.strictEqual(lines[plainUrlIndex + 1], '', 'plainUrl should have a blank line below it')

      const ESC = '\x1b'
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC'
      const expectedLabel = 'Click here to open the Google Sign-in page in your browser'
      const expectedLink = `🔗 ${ESC}]8;;${url}${ESC}\\${expectedLabel}${ESC}]8;;${ESC}\\`
      assert.ok(lines.includes(expectedLink), 'Should contain the OSC 8 formatted hyperlink')
    } finally {
      delete process.env.FORCE_HYPERLINK
    }
  })

  test('When cep_auth is invoked and the wait window expires without terminal hyperlink support, then it returns status=awaiting with plain URL and no OSC 8 sequences', async () => {
    process.env.FORCE_HYPERLINK = '0'
    try {
      const startToolAuth = mock.fn(async () => ({
        status: 'awaiting',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC',
        browserAttempted: false,
        browserOpened: false,
        expiresAt: new Date(Date.now() + 300_000),
        source: 'managed',
      }))
      const completeToolAuth = mock.fn()
      await register({ startToolAuth, completeToolAuth })

      const result = await handler({}, {})

      assert.strictEqual(result.structuredContent.status, 'awaiting')
      assert.strictEqual(result.structuredContent.nextAction, 'paste-redirect-url')
      assert.strictEqual(result.structuredContent.authUrl, 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC')
      assert.ok(result.structuredContent.agentHint?.length > 0)
      assert.match(result.content[0].text, /Open this URL/)
      assert.match(result.content[0].text, /accounts\.google\.com/)

      const text = result.content[0].text
      assert.ok(!text.includes('\x1b]8;;'), 'Should not contain any OSC 8 hyperlink escapes')

      const lines = text.split('\n')
      const plainUrlIndex = lines.findIndex(l => l === 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC')
      assert.ok(plainUrlIndex > 0, 'plainUrl should appear in the text block')
      assert.strictEqual(lines[plainUrlIndex - 1], '', 'plainUrl should have a blank line above it')
      assert.strictEqual(lines[plainUrlIndex + 1], '', 'plainUrl should have a blank line below it')
    } finally {
      delete process.env.FORCE_HYPERLINK
    }
  })

  test('When cep_auth is invoked with a valid redirectUrl, then it calls completeToolAuth and returns status=completed', async () => {
    const future = new Date(Date.now() + 3_600_000)
    const startToolAuth = mock.fn()
    const completeToolAuth = mock.fn(async () => ({ status: 'completed', expiresAt: future }))
    await register({ startToolAuth, completeToolAuth })

    const result = await handler({ redirectUrl: 'http://127.0.0.1:55555/?code=ABC&state=XYZ' }, {})

    assert.strictEqual(result.structuredContent.status, 'completed')
    assert.strictEqual(completeToolAuth.mock.callCount(), 1)
    assert.deepStrictEqual(completeToolAuth.mock.calls[0].arguments, [
      { redirectUrl: 'http://127.0.0.1:55555/?code=ABC&state=XYZ' },
    ])
    assert.strictEqual(startToolAuth.mock.callCount(), 0)
  })

  test('When cep_auth fails internally, then it returns isError=true and forwards the error code in structuredContent', async () => {
    const startToolAuth = mock.fn()
    const completeToolAuth = mock.fn(async () => {
      const err = new Error('State mismatch.')
      err.code = 'STATE_MISMATCH'
      throw err
    })
    await register({ startToolAuth, completeToolAuth })

    const result = await handler({ redirectUrl: 'http://127.0.0.1:1/?code=x&state=wrong' }, {})

    assert.strictEqual(result.isError, true)
    assert.strictEqual(result.structuredContent.status, 'error')
    assert.strictEqual(result.structuredContent.code, 'STATE_MISMATCH')
    assert.match(result.content[0].text, /Sign-in failed/)
  })

  test('When cep_auth is invoked with an inbound Bearer token, then it refuses with a BEARER_INBOUND error', async () => {
    const startToolAuth = mock.fn()
    const completeToolAuth = mock.fn()
    await register({ startToolAuth, completeToolAuth })

    const result = await handler({}, { requestInfo: { headers: { authorization: 'Bearer abc' } } })

    assert.strictEqual(result.isError, true)
    assert.strictEqual(result.structuredContent.code, 'BEARER_INBOUND')
    assert.strictEqual(startToolAuth.mock.callCount(), 0)
    assert.strictEqual(completeToolAuth.mock.callCount(), 0)
  })

  test('When cep_auth awaits with the managed OAuth client, then the response suggests the bare npx CLI as fallback', async () => {
    await withClientEnv({ CEP_OAUTH_CLIENT_ID: undefined, CEP_OAUTH_CLIENT_SECRET: undefined }, async () => {
      const startToolAuth = mock.fn(async () => ({
        status: 'awaiting',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC',
        browserAttempted: false,
        browserOpened: false,
        expiresAt: new Date(Date.now() + 300_000),
        source: 'managed',
      }))
      const completeToolAuth = mock.fn()
      await register({ startToolAuth, completeToolAuth })

      const result = await handler({}, {})

      assert.match(
        result.content[0].text,
        /you can also run `npx @google\/chrome-enterprise-premium-mcp auth login` in your shell/,
      )
    })
  })

  test('When cep_auth awaits with a custom OAuth client, then the response tells the user to export the env vars before running the CLI', async () => {
    await withClientEnv({ CEP_OAUTH_CLIENT_ID: 'custom-id', CEP_OAUTH_CLIENT_SECRET: 'custom-secret' }, async () => {
      const startToolAuth = mock.fn(async () => ({
        status: 'awaiting',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC',
        browserAttempted: false,
        browserOpened: false,
        expiresAt: new Date(Date.now() + 300_000),
        source: 'custom',
      }))
      const completeToolAuth = mock.fn()
      await register({ startToolAuth, completeToolAuth })

      const result = await handler({}, {})

      assert.match(
        result.content[0].text,
        /export CEP_OAUTH_CLIENT_ID and CEP_OAUTH_CLIENT_SECRET in your shell and run `npx @google\/chrome-enterprise-premium-mcp auth login`/,
      )
    })
  })
})
