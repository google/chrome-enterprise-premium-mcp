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
import { oauthFlowCredential, defaultOpenBrowser, printConsentUrl } from '../../lib/util/credential/oauth_flow.js'

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

/* Fake child process for openImpl injection — tracks calls and exits with the given code. */
function makeFakeOpen({ exitCode = 0 } = {}) {
  const calls = []
  async function openImpl(url, opts) {
    calls.push({ url, opts })
    const listeners = {}
    const child = {
      on(event, cb) {
        listeners[event] = cb
        if (event === 'exit') {
          setImmediate(() => cb(exitCode))
        }
        return child
      },
      unref() {},
    }
    return child
  }
  return { openImpl, calls }
}

describe('defaultOpenBrowser', () => {
  it('When canLaunchBrowser returns false, then defaultOpenBrowser returns false without invoking open', async () => {
    const { openImpl, calls } = makeFakeOpen()
    const result = await defaultOpenBrowser('https://example.test/consent', {
      openImpl,
      canLaunch: () => false,
    })
    assert.equal(result, false)
    assert.equal(calls.length, 0)
  })

  it('When canLaunchBrowser returns true, then defaultOpenBrowser calls open with the URL and resolves true', async () => {
    const { openImpl, calls } = makeFakeOpen()
    const stream = makeCaptureStream(false)
    const result = await defaultOpenBrowser('https://example.test/consent', {
      openImpl,
      canLaunch: () => true,
      attentionStream: stream,
    })
    assert.equal(result, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://example.test/consent')
  })

  /* eslint-disable require-atomic-updates */
  it('When $BROWSER is set, then defaultOpenBrowser passes it through as the open app name', async () => {
    const prev = process.env.BROWSER
    process.env.BROWSER = 'firefox'
    try {
      const { openImpl, calls } = makeFakeOpen()
      const stream = makeCaptureStream(false)
      await defaultOpenBrowser('https://example.test/consent', {
        openImpl,
        canLaunch: () => true,
        attentionStream: stream,
      })
      assert.equal(calls.length, 1)
      assert.deepEqual(calls[0].opts, { app: { name: 'firefox' } })
    } finally {
      if (prev === undefined) {
        delete process.env.BROWSER
      } else {
        process.env.BROWSER = prev
      }
    }
  })
  /* eslint-enable require-atomic-updates */

  it('When open throws synchronously or rejects, then defaultOpenBrowser resolves false', async () => {
    async function openImpl() {
      throw new Error('spawn failed')
    }
    const stream = makeCaptureStream(false)
    const result = await defaultOpenBrowser('https://example.test/consent', {
      openImpl,
      canLaunch: () => true,
      attentionStream: stream,
    })
    assert.equal(result, false)
  })

  it('When openBrowser exits with code 0 on TTY, then a BEL is written to stderr', async () => {
    const { openImpl } = makeFakeOpen({ exitCode: 0 })
    const stream = makeCaptureStream(true)
    const result = await defaultOpenBrowser('https://example.test/consent', {
      openImpl,
      canLaunch: () => true,
      attentionStream: stream,
    })
    assert.equal(result, true)
    assert.ok(stream.text.includes('\x07'), 'expected BEL character on TTY')
  })

  it('When openBrowser exits with code non-zero on TTY, then no BEL is written', async () => {
    const { openImpl } = makeFakeOpen({ exitCode: 1 })
    const stream = makeCaptureStream(true)
    const result = await defaultOpenBrowser('https://example.test/consent', {
      openImpl,
      canLaunch: () => true,
      attentionStream: stream,
    })
    assert.equal(result, false)
    assert.ok(!stream.text.includes('\x07'), 'expected no BEL when launch exits non-zero')
  })

  it('When stderr is not a TTY, then no BEL is written', async () => {
    const { openImpl } = makeFakeOpen()
    const stream = makeCaptureStream(false)
    await defaultOpenBrowser('https://example.test/consent', {
      openImpl,
      canLaunch: () => true,
      attentionStream: stream,
    })
    assert.equal(stream.text, '')
  })
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
