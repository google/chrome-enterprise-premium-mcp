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
process.env.NO_COLOR = '1'
import { describe, test, mock, beforeEach } from 'node:test'
import esmock from 'esmock'
import { cliInvocation } from '../../lib/util/cli_invocation.js'

async function loadToolWithMocks({ startToolAuth, completeToolAuth, canLaunchBrowser }) {
  return esmock('../../tools/definitions/auth.js', {
    '../../lib/util/credential/auth_login.js': {
      startToolAuth,
      completeToolAuth,
      canLaunchBrowser,
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

  async function getHandler(toolName, mocks) {
    const { registerAuthTool } = await loadToolWithMocks(mocks)
    registerAuthTool(server)
    const call = server.registerTool.mock.calls.find(c => c.arguments[0] === toolName)
    assert.ok(call, `${toolName} was not registered`)
    return call.arguments[2]
  }

  async function register(mocks) {
    handler = await getHandler('cep_auth', mocks)
  }

  test('When cep_auth is invoked and returns status=awaiting, then it prints the plain URL once and sets correct structured content', async () => {
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
    assert.match(result.content[0].text, /Open the URL below/)
    assert.match(result.content[0].text, /accounts\.google\.com/)

    const lines = result.content[0].text.split('\n')
    const plainUrlIndex = lines.findIndex(l => l === 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC')
    assert.ok(plainUrlIndex > 0, 'plainUrl should appear in the text block')
    assert.strictEqual(lines[plainUrlIndex - 1], '', 'plainUrl should have a blank line above it')
    assert.strictEqual(lines[plainUrlIndex + 1], '', 'plainUrl should have a blank line below it')

    const occurrences = lines.filter(l => l.includes('https://accounts.google.com/o/oauth2/v2/auth?state=ABC')).length
    assert.strictEqual(occurrences, 1, 'Should only print the URL once')
    assert.ok(!result.content[0].text.includes('\x1b]8;;'), 'Should not contain any OSC 8 hyperlink escapes')
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

      const manualLogin = cliInvocation('auth login')
      assert.ok(
        result.content[0].text.includes(`you can also run \`${manualLogin}\` in your shell`),
        `Expected output to contain: "you can also run \`${manualLogin}\` in your shell"`,
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

      const manualLogin = cliInvocation('auth login')
      assert.ok(
        result.content[0].text.includes(
          `export CEP_OAUTH_CLIENT_ID and CEP_OAUTH_CLIENT_SECRET in your shell and run \`${manualLogin}\``,
        ),
        `Expected output to contain env exports and running: "${manualLogin}"`,
      )
    })
  })

  test('When cep_auth awaits and browserOpened is true, then it displays a concise instruction set without detailed steps', async () => {
    const startToolAuth = mock.fn(async () => ({
      status: 'awaiting',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=ABC',
      browserAttempted: true,
      browserOpened: true,
      expiresAt: new Date(Date.now() + 300_000),
      source: 'managed',
    }))
    const completeToolAuth = mock.fn()
    await register({ startToolAuth, completeToolAuth })

    const result = await handler({}, {})

    assert.strictEqual(result.structuredContent.status, 'awaiting')
    assert.strictEqual(result.structuredContent.nextAction, 'complete-in-browser')
    assert.strictEqual(result.structuredContent.browserOpened, true)
    assert.match(result.content[0].text, /A browser tab should have opened/)
    assert.match(result.content[0].text, /Once you sign in and see the "Signed in" success message/)
    assert.match(
      result.content[0].text,
      /If the browser did not open, please ask your agent to help you sign in manually/,
    )
    // Verify it does NOT contain the long manual instructions steps
    assert.ok(!result.content[0].text.includes('1. Open the URL below'))
    assert.ok(!result.content[0].text.includes('2. Sign in with your Google account'))
  })

  test('When cep_auth awaits and browserOpened is false, then it displays the full manual instructions', async () => {
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
    assert.strictEqual(result.structuredContent.browserOpened, false)
    assert.match(result.content[0].text, /I cannot open a browser in this environment/)
    assert.match(result.content[0].text, /1\. Open the URL below/)
    assert.match(result.content[0].text, /2\. Sign in with your Google account/)
    assert.match(result.content[0].text, /3\. Copy that entire new address/)
  })

  test('When cep_auth is called with authMethod, then it passes it down to startToolAuth', async () => {
    const startToolAuth = mock.fn(async () => ({
      status: 'completed',
      source: 'managed',
    }))
    const completeToolAuth = mock.fn()
    await register({ startToolAuth, completeToolAuth })

    await handler({ authMethod: 'manual' }, {})

    assert.strictEqual(startToolAuth.mock.callCount(), 1)
    assert.deepStrictEqual(startToolAuth.mock.calls[0].arguments, [{ authMethod: 'manual' }])
  })

  test('When cep_auth_status is called, then it includes canLaunchBrowser in the response status data', async () => {
    const canLaunchBrowserMock = mock.fn(() => true)
    const statusHandler = await getHandler('cep_auth_status', {
      canLaunchBrowser: canLaunchBrowserMock,
      startToolAuth: mock.fn(),
      completeToolAuth: mock.fn(),
    })

    const result = await statusHandler({}, {})

    assert.strictEqual(result.isError, undefined)
    assert.strictEqual(result.structuredContent.status.canLaunchBrowser, true)
    assert.strictEqual(canLaunchBrowserMock.mock.callCount(), 1)
  })
})
