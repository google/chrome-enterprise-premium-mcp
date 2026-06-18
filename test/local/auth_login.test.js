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
import { describe, test, beforeEach, afterEach, mock } from 'node:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  isTokenLocallyValid,
  canLaunchBrowser,
  startToolAuth,
  completeToolAuth,
  _resetPendingAuthForTests,
} from '../../lib/util/credential/auth_login.js'

function tmpCachePath() {
  return path.join(os.tmpdir(), `cep-auth-login-test-${process.pid}-${Math.random().toString(16).slice(2)}.json`)
}

async function writeCache(cachePath, body) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true })
  await fs.writeFile(cachePath, JSON.stringify(body), { mode: 0o600 })
}

describe('isTokenLocallyValid', () => {
  let cachePath
  beforeEach(() => {
    cachePath = tmpCachePath()
  })
  afterEach(async () => {
    await fs.unlink(cachePath).catch(() => {})
  })

  test('When the cache file is missing, then it returns { ok: false, reason: missing }', async () => {
    const result = await isTokenLocallyValid({ cachePath })
    assert.deepStrictEqual(result, { ok: false, reason: 'missing' })
  })

  test('When the cache has no access_token, then it returns { ok: false, reason: malformed }', async () => {
    await writeCache(cachePath, { expiry_date: Date.now() + 60_000 })
    const result = await isTokenLocallyValid({ cachePath })
    assert.deepStrictEqual(result, { ok: false, reason: 'malformed' })
  })

  test('When the cache has an expired access_token, then it returns { ok: false, reason: expired } with the expiry date', async () => {
    const expired = Date.now() - 5_000
    await writeCache(cachePath, { access_token: 'tok', expiry_date: expired })
    const result = await isTokenLocallyValid({ cachePath })
    assert.strictEqual(result.ok, false)
    assert.strictEqual(result.reason, 'expired')
    assert.ok(result.expiresAt instanceof Date)
    assert.strictEqual(result.expiresAt.getTime(), expired)
  })

  test('When the cache has a fresh access_token, then it returns { ok: true } with the expiry date', async () => {
    const future = Date.now() + 60_000
    await writeCache(cachePath, { access_token: 'tok', expiry_date: future })
    const result = await isTokenLocallyValid({ cachePath })
    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.expiresAt.getTime(), future)
  })

  test('When the cache has an access_token without expiry_date, then it returns { ok: true, expiresAt: null }', async () => {
    await writeCache(cachePath, { access_token: 'tok' })
    const result = await isTokenLocallyValid({ cachePath })
    assert.deepStrictEqual(result, { ok: true, expiresAt: null })
  })
})

describe('canLaunchBrowser', () => {
  /* Default fs stub: no /.dockerenv and no docker/kubepods cgroup. */
  const fsClean = { existsSync: () => false, readFileSync: () => '' }

  test('When SSH_CONNECTION is set, then it returns false', () => {
    assert.strictEqual(
      canLaunchBrowser({ env: { SSH_CONNECTION: '10.0.0.1 22' }, platform: 'darwin', fs: fsClean }),
      false,
    )
  })

  test('When SSH_TTY is set, then it returns false', () => {
    assert.strictEqual(canLaunchBrowser({ env: { SSH_TTY: '/dev/pts/0' }, platform: 'linux', fs: fsClean }), false)
  })

  test('When the platform is Linux without DISPLAY or WAYLAND_DISPLAY, then it returns false', () => {
    assert.strictEqual(canLaunchBrowser({ env: {}, platform: 'linux', fs: fsClean }), false)
  })

  test('When the platform is Linux with DISPLAY, then it returns true', () => {
    assert.strictEqual(canLaunchBrowser({ env: { DISPLAY: ':0' }, platform: 'linux', fs: fsClean }), true)
  })

  test('When the platform is darwin without SSH, then it returns true', () => {
    assert.strictEqual(canLaunchBrowser({ env: {}, platform: 'darwin', fs: fsClean }), true)
  })

  test('When the platform is win32 without SSH, then it returns true', () => {
    assert.strictEqual(canLaunchBrowser({ env: {}, platform: 'win32', fs: fsClean }), true)
  })

  test('When /.dockerenv exists on Linux, then it returns false', () => {
    const fs = { existsSync: p => p === '/.dockerenv', readFileSync: () => '' }
    assert.strictEqual(canLaunchBrowser({ env: { DISPLAY: ':0' }, platform: 'linux', fs }), false)
  })

  test('When /proc/1/cgroup names docker on Linux, then it returns false', () => {
    const fs = {
      existsSync: () => false,
      readFileSync: () => '12:cpu:/docker/abc123\n11:memory:/docker/abc123\n',
    }
    assert.strictEqual(canLaunchBrowser({ env: { DISPLAY: ':0' }, platform: 'linux', fs }), false)
  })

  test('When /proc/1/cgroup names kubepods on Linux, then it returns false', () => {
    const fs = {
      existsSync: () => false,
      readFileSync: () => '0::/kubepods.slice/kubepods-besteffort.slice\n',
    }
    assert.strictEqual(canLaunchBrowser({ env: { DISPLAY: ':0' }, platform: 'linux', fs }), false)
  })

  test('When /proc/1/cgroup is unreadable on Linux, then container detection is skipped', () => {
    const fs = {
      existsSync: () => false,
      readFileSync: () => {
        throw new Error('ENOENT')
      },
    }
    assert.strictEqual(canLaunchBrowser({ env: { DISPLAY: ':0' }, platform: 'linux', fs }), true)
  })
})

/* Shared fakes for the startToolAuth / completeToolAuth tests. */
function makeFakeServer({ codePromise } = {}) {
  let stopped = false
  return {
    redirectUri: 'http://127.0.0.1:55555/',
    waitForCode: () => codePromise ?? new Promise(() => {}),
    stop: async () => {
      stopped = true
    },
    wasStopped: () => stopped,
  }
}

function makeFakeOAuth2Client({ codeVerifier = 'V', codeChallenge = 'C', authUrl = 'https://auth/' } = {}) {
  const calls = { getToken: [] }
  return {
    client: {
      async generateCodeVerifierAsync() {
        return { codeVerifier, codeChallenge }
      },
      generateAuthUrl(opts) {
        calls.lastAuthUrlOpts = opts
        return `${authUrl}?state=${opts.state}&challenge=${opts.code_challenge}`
      },
      async getToken({ code, codeVerifier: cv }) {
        calls.getToken.push({ code, codeVerifier: cv })
        return { tokens: { access_token: 'tok-' + code, expiry_date: Date.now() + 3_600_000, token_type: 'Bearer' } }
      },
    },
    calls,
  }
}

const FAKE_CONFIG = { clientId: 'fake-client', clientSecret: 'fake-secret', source: 'managed' }

describe('startToolAuth', () => {
  let cachePath
  beforeEach(async () => {
    cachePath = tmpCachePath()
    await _resetPendingAuthForTests()
  })
  afterEach(async () => {
    await _resetPendingAuthForTests()
    await fs.unlink(cachePath).catch(() => {})
  })

  test('When startToolAuth times out before the callback fires, then it returns status=awaiting with the consent URL', async () => {
    const { client } = makeFakeOAuth2Client()
    const server = makeFakeServer({ codePromise: new Promise(() => {}) /* never resolves */ })
    const result = await startToolAuth({
      env: { SSH_CONNECTION: 'x' /* force headless */ },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer: async () => server,
      oauth2ClientFactory: () => client,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
      awaitCallbackMs: 25,
    })
    assert.strictEqual(result.status, 'awaiting')
    assert.match(result.authUrl, /state=[a-f0-9]{32}/)
    assert.match(result.authUrl, /challenge=C/)
    assert.strictEqual(result.browserAttempted, false)
    assert.strictEqual(result.browserOpened, false)
  })

  test('When a background callback returns a mismatched state, then it cancels the pending auth and does not write the cache', async () => {
    const { client } = makeFakeOAuth2Client()
    let resolveCallback
    const codePromise = new Promise(resolve => {
      resolveCallback = resolve
    })
    const server = makeFakeServer({ codePromise })
    await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer: async () => server,
      oauth2ClientFactory: () => client,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
    })

    resolveCallback({ code: 'evil', state: 'attacker-state' })

    await new Promise(resolve => {
      setTimeout(resolve, 50)
    })

    const exists = await fs
      .stat(cachePath)
      .then(() => true)
      .catch(() => false)
    assert.strictEqual(exists, false)
    assert.ok(server.wasStopped())
  })

  test('When a background callback returns access_denied, then it cancels the pending auth and does not write the cache', async () => {
    const { client } = makeFakeOAuth2Client()
    let resolveCallback
    const codePromise = new Promise(resolve => {
      resolveCallback = resolve
    })
    const server = makeFakeServer({ codePromise })
    await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer: async () => server,
      oauth2ClientFactory: () => client,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
    })

    resolveCallback({ error: 'access_denied' })

    await new Promise(resolve => {
      setTimeout(resolve, 50)
    })

    const exists = await fs
      .stat(cachePath)
      .then(() => true)
      .catch(() => false)
    assert.strictEqual(exists, false)
    assert.ok(server.wasStopped())
  })

  test('When a loopback callback fires after the pending session has been cleared or reset, it does not write the cache or proceed', async () => {
    const { client, calls } = makeFakeOAuth2Client()
    let receivedState
    let resolveCallback
    const codePromise = new Promise(resolve => {
      resolveCallback = resolve
    })
    const server = makeFakeServer({ codePromise })
    const captureClient = {
      ...client,
      generateAuthUrl(opts) {
        receivedState = opts.state
        return client.generateAuthUrl(opts)
      },
    }
    await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer: async () => server,
      oauth2ClientFactory: () => captureClient,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
    })

    // Manually clear the pending session (simulating expiration, clear, or restart)
    await _resetPendingAuthForTests()

    // Trigger callback of the old session
    resolveCallback({ code: 'old-code', state: receivedState })

    // Wait for background execution
    await new Promise(resolve => {
      setTimeout(resolve, 50)
    })

    // Assert that token exchange was NOT called because the session was reset!
    assert.strictEqual(calls.getToken.length, 0)
    const exists = await fs
      .stat(cachePath)
      .then(() => true)
      .catch(() => false)
    assert.strictEqual(exists, false)
    assert.ok(server.wasStopped())
  })

  test('When startToolAuth is called, then it returns awaiting immediately and exchanges the code in the background when the callback fires', async () => {
    const { client, calls } = makeFakeOAuth2Client()
    let resolveCallback
    const codePromise = new Promise(resolve => {
      resolveCallback = resolve
    })
    const server = makeFakeServer({ codePromise })
    const result = await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer: async () => server,
      oauth2ClientFactory: () => client,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
    })
    assert.strictEqual(result.status, 'awaiting')
    assert.strictEqual(calls.getToken.length, 0)

    const state = new URL(result.authUrl).searchParams.get('state')
    resolveCallback({ code: 'late-code', state })

    await new Promise(resolve => {
      setTimeout(resolve, 50)
    })

    assert.strictEqual(calls.getToken.length, 1)
    assert.strictEqual(calls.getToken[0].code, 'late-code')
    const cached = JSON.parse(await fs.readFile(cachePath, 'utf8'))
    assert.strictEqual(cached.access_token, 'tok-late-code')
    assert.ok(server.wasStopped())
  })

  test('When startToolAuth is called twice, both attempts remain active until one completes and cancels both', async () => {
    const { client, calls } = makeFakeOAuth2Client()
    let resolve1
    const server1 = makeFakeServer({
      codePromise: new Promise(r => {
        resolve1 = r
      }),
    })
    const server2 = makeFakeServer({ codePromise: new Promise(() => {}) })
    let count = 0
    const startServer = async () => (count++ === 0 ? server1 : server2)

    const res1 = await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer,
      oauth2ClientFactory: () => client,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
    })
    await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer,
      oauth2ClientFactory: () => client,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
    })

    assert.strictEqual(server1.wasStopped(), false)
    assert.strictEqual(server2.wasStopped(), false)

    const state1 = new URL(res1.authUrl).searchParams.get('state')
    resolve1({ code: 'code1', state: state1 })

    await new Promise(resolve => {
      setTimeout(resolve, 50)
    })

    assert.strictEqual(calls.getToken.length, 1)
    assert.strictEqual(calls.getToken[0].code, 'code1')
    assert.strictEqual(server1.wasStopped(), true)
    assert.strictEqual(server2.wasStopped(), true)
  })

  test('When startToolAuth is called with authMethod="manual", then it does not check browserAvailable or attempt browser launch', async () => {
    const { client } = makeFakeOAuth2Client()
    const server = makeFakeServer()
    const browserAvailable = mock.fn(() => true)
    const openBrowser = mock.fn(async () => true)

    const result = await startToolAuth({
      authMethod: 'manual',
      browserAvailable,
      openBrowser,
      startServer: async () => server,
      oauth2ClientFactory: () => client,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
    })

    assert.strictEqual(result.status, 'awaiting')
    assert.strictEqual(result.browserAttempted, false)
    assert.strictEqual(result.browserOpened, false)
    assert.strictEqual(browserAvailable.mock.callCount(), 0)
    assert.strictEqual(openBrowser.mock.callCount(), 0)
  })

  test('When startToolAuth is called with authMethod="browser", then it attempts browser launch regardless of browserAvailable', async () => {
    const { client } = makeFakeOAuth2Client()
    const server = makeFakeServer()
    const browserAvailable = mock.fn(() => false)
    const openBrowser = mock.fn(async () => true)

    const result = await startToolAuth({
      authMethod: 'browser',
      browserAvailable,
      openBrowser,
      startServer: async () => server,
      oauth2ClientFactory: () => client,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
    })

    assert.strictEqual(result.status, 'awaiting')
    assert.strictEqual(result.browserAttempted, true)
    assert.strictEqual(result.browserOpened, true)
    assert.strictEqual(browserAvailable.mock.callCount(), 0)
    assert.strictEqual(openBrowser.mock.callCount(), 1)
  })
})

describe('completeToolAuth', () => {
  let cachePath
  beforeEach(async () => {
    cachePath = tmpCachePath()
    await _resetPendingAuthForTests()
  })
  afterEach(async () => {
    await _resetPendingAuthForTests()
    await fs.unlink(cachePath).catch(() => {})
  })

  test('When completeToolAuth is called with no pending sign-in, then it rejects with NO_PENDING_AUTH', async () => {
    await assert.rejects(
      completeToolAuth({ redirectUrl: 'http://127.0.0.1:1/?code=x&state=y', cachePath }),
      err => err.code === 'NO_PENDING_AUTH',
    )
  })

  test('When completeToolAuth receives a valid redirectUrl after a pending sign-in, then it exchanges the code and writes the cache', async () => {
    const { client, calls } = makeFakeOAuth2Client()
    let capturedState
    const captureClient = {
      ...client,
      generateAuthUrl(opts) {
        capturedState = opts.state
        return client.generateAuthUrl(opts)
      },
    }
    const server = makeFakeServer({ codePromise: new Promise(() => {}) })
    await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer: async () => server,
      oauth2ClientFactory: () => captureClient,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
      awaitCallbackMs: 25,
    })
    const result = await completeToolAuth({
      redirectUrl: `http://127.0.0.1:55555/?code=pasted-code&state=${capturedState}`,
      cachePath,
    })
    assert.strictEqual(result.status, 'completed')
    assert.strictEqual(calls.getToken[0].code, 'pasted-code')
    assert.strictEqual(calls.getToken[0].codeVerifier, 'V')
    const cached = JSON.parse(await fs.readFile(cachePath, 'utf8'))
    assert.strictEqual(cached.access_token, 'tok-pasted-code')
  })

  test('When completeToolAuth receives a redirectUrl with a mismatched state, then it rejects with STATE_MISMATCH and leaves the cache alone', async () => {
    const { client } = makeFakeOAuth2Client()
    const server = makeFakeServer({ codePromise: new Promise(() => {}) })
    await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer: async () => server,
      oauth2ClientFactory: () => client,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
      awaitCallbackMs: 25,
    })
    await assert.rejects(
      completeToolAuth({ redirectUrl: 'http://127.0.0.1:1/?code=x&state=wrong', cachePath }),
      err => err.code === 'STATE_MISMATCH',
    )
    const exists = await fs
      .stat(cachePath)
      .then(() => true)
      .catch(() => false)
    assert.strictEqual(exists, false)
  })

  test('When completeToolAuth receives an unparseable redirectUrl, then it rejects with BAD_REDIRECT_URL', async () => {
    const { client } = makeFakeOAuth2Client()
    const server = makeFakeServer({ codePromise: new Promise(() => {}) })
    await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer: async () => server,
      oauth2ClientFactory: () => client,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
      awaitCallbackMs: 25,
    })
    await assert.rejects(
      completeToolAuth({ redirectUrl: 'not a url', cachePath }),
      err => err.code === 'BAD_REDIRECT_URL',
    )
  })

  test('When completeToolAuth receives a redirectUrl carrying an error parameter, then it rejects with the mapped code', async () => {
    const { client } = makeFakeOAuth2Client()
    let capturedState
    const captureClient = {
      ...client,
      generateAuthUrl(opts) {
        capturedState = opts.state
        return client.generateAuthUrl(opts)
      },
    }
    const server = makeFakeServer({ codePromise: new Promise(() => {}) })
    await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer: async () => server,
      oauth2ClientFactory: () => captureClient,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
      awaitCallbackMs: 25,
    })
    await assert.rejects(
      completeToolAuth({ redirectUrl: `http://127.0.0.1:1/?error=access_denied&state=${capturedState}`, cachePath }),
      err => err.code === 'ACCESS_DENIED',
    )
  })

  test('When completeToolAuth is called with a valid cached token, then it returns completed immediately without pending auth', async () => {
    const future = Date.now() + 3600 * 1000
    await writeCache(cachePath, { access_token: 'pre-existing-token', expiry_date: future })
    const result = await completeToolAuth({
      redirectUrl: 'http://127.0.0.1:1/?code=x&state=y',
      cachePath,
    })
    assert.strictEqual(result.status, 'completed')
    assert.strictEqual(result.expiresAt.getTime(), future)
  })
})
