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
import { describe, test, beforeEach, afterEach } from 'node:test'
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

  test('When the loopback callback fires before timeout with a matching state, then it exchanges the code and writes the cache', async () => {
    const { client, calls } = makeFakeOAuth2Client()
    let receivedState
    const codePromise = new Promise(resolve => {
      // Resolve once we know the generated state.
      setImmediate(() => {
        resolve({ code: 'good-code', state: receivedState })
      })
    })
    const server = makeFakeServer({ codePromise })
    /* Capture the state generated by the auth URL so the fake callback echoes it back. */
    const captureClient = {
      ...client,
      generateAuthUrl(opts) {
        receivedState = opts.state
        return client.generateAuthUrl(opts)
      },
    }
    const result = await startToolAuth({
      env: { SSH_CONNECTION: 'x' },
      browserAvailable: () => false,
      openBrowser: async () => false,
      startServer: async () => server,
      oauth2ClientFactory: () => captureClient,
      configResolver: () => FAKE_CONFIG,
      cachePath,
      scopes: ['scope-a'],
      awaitCallbackMs: 1000,
    })
    assert.strictEqual(result.status, 'completed')
    assert.strictEqual(calls.getToken.length, 1)
    assert.strictEqual(calls.getToken[0].code, 'good-code')
    const cached = JSON.parse(await fs.readFile(cachePath, 'utf8'))
    assert.strictEqual(cached.access_token, 'tok-good-code')
    assert.strictEqual(cached.scope, 'scope-a')
  })

  test('When the loopback callback returns a mismatched state, then startToolAuth rejects without writing the cache', async () => {
    const { client } = makeFakeOAuth2Client()
    const codePromise = Promise.resolve({ code: 'evil', state: 'attacker-state' })
    const server = makeFakeServer({ codePromise })
    await assert.rejects(
      startToolAuth({
        env: { SSH_CONNECTION: 'x' },
        browserAvailable: () => false,
        openBrowser: async () => false,
        startServer: async () => server,
        oauth2ClientFactory: () => client,
        configResolver: () => FAKE_CONFIG,
        cachePath,
        scopes: ['scope-a'],
        awaitCallbackMs: 1000,
      }),
      err => err.code === 'STATE_MISMATCH',
    )
    const exists = await fs
      .stat(cachePath)
      .then(() => true)
      .catch(() => false)
    assert.strictEqual(exists, false)
  })

  test('When the loopback callback returns access_denied, then startToolAuth rejects with ACCESS_DENIED', async () => {
    const { client } = makeFakeOAuth2Client()
    const codePromise = Promise.resolve({ error: 'access_denied' })
    const server = makeFakeServer({ codePromise })
    await assert.rejects(
      startToolAuth({
        env: { SSH_CONNECTION: 'x' },
        browserAvailable: () => false,
        openBrowser: async () => false,
        startServer: async () => server,
        oauth2ClientFactory: () => client,
        configResolver: () => FAKE_CONFIG,
        cachePath,
        scopes: ['scope-a'],
        awaitCallbackMs: 1000,
      }),
      err => err.code === 'ACCESS_DENIED',
    )
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
      completeToolAuth({ redirectUrl: 'http://127.0.0.1:1/?code=x&state=y' }),
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
      completeToolAuth({ redirectUrl: 'http://127.0.0.1:1/?code=x&state=wrong' }),
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
    await assert.rejects(completeToolAuth({ redirectUrl: 'not a url' }), err => err.code === 'BAD_REDIRECT_URL')
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
      completeToolAuth({ redirectUrl: `http://127.0.0.1:1/?error=access_denied&state=${capturedState}` }),
      err => err.code === 'ACCESS_DENIED',
    )
  })
})
