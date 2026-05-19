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
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  oauthFlowCredential,
  defaultOpenBrowser,
  printConsentUrl,
  _resetChromeDetectionCacheForTests,
} from '../../lib/util/credential/oauth_flow.js'

async function tmpCachePath(name) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-oauth-test-'))
  return path.join(dir, name || 'tokens.json')
}

describe('oauthFlowCredential probe', () => {
  it('When the cache is missing, then probe returns ok:false with the run-login remediation', async () => {
    const cred = oauthFlowCredential({ clientId: 'test', clientSecret: 'test', cachePath: await tmpCachePath() })
    const probe = await cred.probe()
    assert.equal(probe.ok, false)
    assert.equal(probe.source, 'oauth-flow')
    const lines = cred.buildRemediation(probe, [])
    assert.ok(lines.some(l => /mcp auth login/i.test(l)))
  })

  it('When the cache has a valid access token, then probe returns ok:true with principal', async () => {
    const cachePath = await tmpCachePath()
    const future = Date.now() + 60_000
    await fs.writeFile(
      cachePath,
      JSON.stringify({
        access_token: 'a',
        refresh_token: 'r',
        expiry_date: future,
        scope: 'https://www.googleapis.com/auth/userinfo.email',
        id_token: makeIdToken({ email: 'tim@example.com' }),
      }),
      { mode: 0o600 },
    )
    const cred = oauthFlowCredential({
      clientId: 'test',
      clientSecret: 'test',
      cachePath,
      requiredScopes: ['https://www.googleapis.com/auth/userinfo.email'],
    })
    const probe = await cred.probe()
    assert.equal(probe.ok, true)
    assert.equal(probe.source, 'oauth-flow')
    assert.equal(probe.principal, 'tim@example.com')
  })

  it('When the cached scopes do not cover required scopes, then probe returns ok:false with missingScopes populated', async () => {
    const cachePath = await tmpCachePath()
    await fs.writeFile(
      cachePath,
      JSON.stringify({
        access_token: 'a',
        refresh_token: 'r',
        expiry_date: Date.now() + 60_000,
        scope: 'https://www.googleapis.com/auth/userinfo.email',
      }),
      { mode: 0o600 },
    )
    const cred = oauthFlowCredential({
      clientId: 'test',
      clientSecret: 'test',
      cachePath,
      requiredScopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/cloud-platform',
      ],
    })
    const probe = await cred.probe()
    assert.equal(probe.ok, false)
    assert.deepEqual(probe.missingScopes, ['https://www.googleapis.com/auth/cloud-platform'])
  })

  it('When the cache file mode is wider than 0600, then probe is ok:true with a permissions warning flag', async () => {
    const cachePath = await tmpCachePath()
    await fs.writeFile(
      cachePath,
      JSON.stringify({
        access_token: 'a',
        refresh_token: 'r',
        expiry_date: Date.now() + 60_000,
        scope: 'https://www.googleapis.com/auth/userinfo.email',
      }),
      { mode: 0o644 },
    )
    const cred = oauthFlowCredential({
      clientId: 'test',
      clientSecret: 'test',
      cachePath,
      requiredScopes: ['https://www.googleapis.com/auth/userinfo.email'],
    })
    const probe = await cred.probe()
    assert.equal(probe.ok, true)
    assert.equal(probe.permissionsWarning, true)
  })
})

function makeIdToken(payload) {
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${b64({ alg: 'RS256' })}.${b64(payload)}.signature`
}

describe('oauthFlowCredential runLoginFlow', () => {
  it('When access_denied error is returned to the loopback, then runLoginFlow throws the consent-declined message', async () => {
    const cachePath = await tmpCachePath()
    const cred = oauthFlowCredential({ clientId: 'client123', clientSecret: 'secret', cachePath })

    // openBrowser hits the loopback server with ?error=access_denied instead of opening a real browser.
    async function openBrowser(url) {
      // Extract the redirect_uri from the consent URL and fire a fetch to it.
      const parsed = new URL(url)
      const redirectUri = parsed.searchParams.get('redirect_uri')
      await fetch(`${redirectUri}?error=access_denied`)
    }

    await assert.rejects(
      () => cred.runLoginFlow({ openBrowser }),
      err => {
        assert.ok(err.message.includes('Consent declined'), `unexpected message: ${err.message}`)
        return true
      },
    )
  })

  it('When the OAuth code-exchange returns redirect_uri_mismatch, then runLoginFlow throws the parent-issue message with a truncated client_id hint', async () => {
    const cachePath = await tmpCachePath()
    const clientId = 'client-mismatch-456'
    const cred = oauthFlowCredential({ clientId, clientSecret: 'secret', cachePath })

    async function openBrowser(url) {
      const parsed = new URL(url)
      const redirectUri = parsed.searchParams.get('redirect_uri')
      await fetch(`${redirectUri}?code=fakecode`)
    }

    // Inject an OAuth2Client whose getToken always throws redirect_uri_mismatch.
    function createOAuth2Client(cfg) {
      return {
        generateAuthUrl(params) {
          // Must return a URL that openBrowser can parse, including redirect_uri.
          const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
          u.searchParams.set('redirect_uri', cfg.redirectUri)
          u.searchParams.set('scope', (params.scope || []).join(' '))
          return u.toString()
        },
        async getToken(_code) {
          const err = new Error('redirect_uri_mismatch')
          err.response = { data: { error: 'redirect_uri_mismatch' } }
          throw err
        },
      }
    }

    await assert.rejects(
      () => cred.runLoginFlow({ openBrowser, createOAuth2Client }),
      err => {
        const idHint = clientId.slice(0, 8) + '...'
        assert.ok(
          err.message.includes(idHint),
          `expected message to include truncated client_id "${idHint}", got: ${err.message}`,
        )
        assert.ok(
          err.message.includes('http://127.0.0.1'),
          `expected message to mention redirect URI, got: ${err.message}`,
        )
        return true
      },
    )
  })

  it('When the OAuth code exchange succeeds, then runLoginFlow writes tokens to the cache file with mode 0600', async () => {
    const cachePath = await tmpCachePath()
    const cred = oauthFlowCredential({ clientId: 'client789', clientSecret: 'secret', cachePath })

    const fakeTokens = {
      access_token: 'access-abc',
      refresh_token: 'refresh-xyz',
      expiry_date: Date.now() + 3600_000,
    }

    async function openBrowser(url) {
      const parsed = new URL(url)
      const redirectUri = parsed.searchParams.get('redirect_uri')
      await fetch(`${redirectUri}?code=fakecode`)
    }

    function createOAuth2Client(cfg) {
      return {
        generateAuthUrl(params) {
          const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
          u.searchParams.set('redirect_uri', cfg.redirectUri)
          u.searchParams.set('scope', (params.scope || []).join(' '))
          return u.toString()
        },
        async getToken(_code) {
          return { tokens: fakeTokens }
        },
      }
    }

    const returned = await cred.runLoginFlow({ openBrowser, createOAuth2Client })
    assert.equal(returned.access_token, fakeTokens.access_token)

    const raw = await fs.readFile(cachePath, 'utf8')
    const cached = JSON.parse(raw)
    assert.equal(cached.access_token, fakeTokens.access_token)
    assert.equal(cached.refresh_token, undefined, 'refresh_token must not be in the persisted cache')

    const stat = await fs.stat(cachePath)
    assert.equal(stat.mode & 0o777, 0o600, `expected cache file mode 0600, got ${(stat.mode & 0o777).toString(8)}`)
  })
})

describe('defaultOpenBrowser', () => {
  /* eslint-disable require-atomic-updates */
  it('When SSH_CONNECTION is set, then defaultOpenBrowser returns false without spawning', async () => {
    const prev = process.env.SSH_CONNECTION
    process.env.SSH_CONNECTION = '10.0.0.1 22 10.0.0.2 22'
    _resetChromeDetectionCacheForTests()
    try {
      const result = await defaultOpenBrowser('https://example.test/consent')
      assert.equal(result, false)
    } finally {
      if (prev === undefined) {
        delete process.env.SSH_CONNECTION
      } else {
        process.env.SSH_CONNECTION = prev
      }
    }
  })
  /* eslint-enable require-atomic-updates */
})

/* Captures a write stream's stderr-style output for assertions. */
function makeCaptureStream(isTTY) {
  const chunks = []
  return {
    isTTY,
    write(s) {
      chunks.push(s)
      return true
    },
    get text() {
      return chunks.join('')
    },
  }
}

describe('printConsentUrl', () => {
  const ESC = String.fromCharCode(0x1b)

  it('When the output stream is a TTY, then the URL is wrapped in an ANSI-coloured box', () => {
    const stream = makeCaptureStream(true)
    printConsentUrl('https://example.test/consent', stream)
    assert.ok(stream.text.includes(`${ESC}[1;36m`), 'expected bright-cyan ANSI sequence')
    assert.ok(stream.text.includes('╔'), 'expected box top corner')
    assert.ok(stream.text.includes('╚'), 'expected box bottom corner')
    assert.ok(stream.text.includes('https://example.test/consent'))
  })

  it('When the output stream is not a TTY, then the plain URL block is written without ANSI', () => {
    const stream = makeCaptureStream(false)
    printConsentUrl('https://example.test/consent', stream)
    assert.ok(!stream.text.includes(`${ESC}[`), 'expected no ANSI escape sequences')
    assert.ok(!stream.text.includes('╔'), 'expected no box drawing characters')
    assert.ok(stream.text.includes('Open this URL to consent:'))
    assert.ok(stream.text.includes('https://example.test/consent'))
  })

  it('When the output stream is a TTY, then the URL inside the box is wrapped with an OSC 8 hyperlink', () => {
    const stream = makeCaptureStream(true)
    const url = 'https://example.test/consent'
    printConsentUrl(url, stream)
    assert.ok(stream.text.includes(`${ESC}]8;;${url}${ESC}\\`), 'expected OSC 8 opener with url target')
    assert.ok(stream.text.includes(`${ESC}]8;;${ESC}\\`), 'expected OSC 8 terminator')
  })
})

/* Fake child process for spawn injection — tracks calls and exits cleanly. */
function makeFakeSpawn() {
  const calls = []
  function spawnImpl(cmd, args) {
    calls.push({ cmd, args })
    const listeners = {}
    const child = {
      on(event, cb) {
        listeners[event] = cb
        if (event === 'exit') {
          setImmediate(() => cb(0))
        }
        return child
      },
      unref() {},
    }
    return child
  }
  return { spawnImpl, calls }
}

describe('defaultOpenBrowser activation', () => {
  function withoutBrowserEnv(fn) {
    const prev = process.env.BROWSER
    delete process.env.BROWSER
    try {
      return fn()
    } finally {
      if (prev === undefined) {
        delete process.env.BROWSER
      } else {
        process.env.BROWSER = prev
      }
    }
  }

  it('When the platform is darwin, then an osascript activate call targets Google Chrome', async () => {
    await withoutBrowserEnv(async () => {
      _resetChromeDetectionCacheForTests()
      const { spawnImpl, calls } = makeFakeSpawn()
      const spawnSyncImpl = () => ({ status: 0, stdout: '/Applications/Google Chrome.app' })
      const stream = makeCaptureStream(false)
      await defaultOpenBrowser('https://example.test/consent', {
        spawnImpl,
        spawnSyncImpl,
        platform: 'darwin',
        attentionStream: stream,
        canLaunch: () => true,
      })
      const osascript = calls.find(c => c.cmd === 'osascript')
      assert.ok(osascript, 'expected an osascript spawn for window activation')
      assert.ok(
        osascript.args.some(a => /tell application "Google Chrome" to activate/.test(a)),
        `expected activate script, got ${JSON.stringify(osascript.args)}`,
      )
    })
  })

  it('When the platform is win32, then a PowerShell AppActivate call targets the Chrome window', async () => {
    await withoutBrowserEnv(async () => {
      const { spawnImpl, calls } = makeFakeSpawn()
      const stream = makeCaptureStream(false)
      await defaultOpenBrowser('https://example.test/consent', {
        spawnImpl,
        spawnSyncImpl: () => ({ status: 1 }),
        platform: 'win32',
        attentionStream: stream,
        canLaunch: () => true,
      })
      const ps = calls.find(c => c.cmd === 'powershell')
      assert.ok(ps, 'expected a powershell spawn for AppActivate')
      assert.ok(
        ps.args.some(a => /AppActivate\('Chrome'\)/.test(a)),
        `expected AppActivate('Chrome'), got ${JSON.stringify(ps.args)}`,
      )
    })
  })

  it('When the platform is linux and wmctrl is on PATH, then a wmctrl -a chrome call fires', async () => {
    await withoutBrowserEnv(async () => {
      const { spawnImpl, calls } = makeFakeSpawn()
      const spawnSyncImpl = (cmd, args) => {
        if (cmd === 'sh' && args?.[1]?.includes('command -v wmctrl')) {
          return { status: 0 }
        }
        return { status: 1 }
      }
      const stream = makeCaptureStream(false)
      await defaultOpenBrowser('https://example.test/consent', {
        spawnImpl,
        spawnSyncImpl,
        platform: 'linux',
        attentionStream: stream,
        canLaunch: () => true,
      })
      const wmctrl = calls.find(c => c.cmd === 'wmctrl')
      assert.ok(wmctrl, 'expected a wmctrl spawn for window activation')
      assert.deepEqual(wmctrl.args, ['-a', 'chrome'])
    })
  })

  it('When the platform is linux and wmctrl is missing, then no wmctrl spawn fires', async () => {
    await withoutBrowserEnv(async () => {
      const { spawnImpl, calls } = makeFakeSpawn()
      const spawnSyncImpl = () => ({ status: 1 })
      const stream = makeCaptureStream(false)
      await defaultOpenBrowser('https://example.test/consent', {
        spawnImpl,
        spawnSyncImpl,
        platform: 'linux',
        attentionStream: stream,
        canLaunch: () => true,
      })
      assert.equal(
        calls.find(c => c.cmd === 'wmctrl'),
        undefined,
      )
    })
  })

  it('When stderr is a TTY, then a BEL and OSC 9 attention hint are written after the launch', async () => {
    await withoutBrowserEnv(async () => {
      const { spawnImpl } = makeFakeSpawn()
      const stream = makeCaptureStream(true)
      await defaultOpenBrowser('https://example.test/consent', {
        spawnImpl,
        spawnSyncImpl: () => ({ status: 1 }),
        platform: 'linux',
        attentionStream: stream,
        canLaunch: () => true,
      })
      assert.ok(stream.text.includes('\x07'), 'expected BEL character on TTY')
      assert.ok(stream.text.includes('\x1b]9;'), 'expected OSC 9 notification sequence on TTY')
    })
  })

  it('When stderr is not a TTY, then no BEL or OSC 9 sequence is written', async () => {
    await withoutBrowserEnv(async () => {
      const { spawnImpl } = makeFakeSpawn()
      const stream = makeCaptureStream(false)
      await defaultOpenBrowser('https://example.test/consent', {
        spawnImpl,
        spawnSyncImpl: () => ({ status: 1 }),
        platform: 'linux',
        attentionStream: stream,
        canLaunch: () => true,
      })
      assert.equal(stream.text, '')
    })
  })
})
