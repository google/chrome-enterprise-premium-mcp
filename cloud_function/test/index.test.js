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

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCredentials,
  buildLoopbackRedirect,
  handleRedirect,
  parseState,
  renderErrorPage,
  renderManualPage,
} from '../index.js'

/** Builds a fake POST impl returning a fixed token-endpoint response. */
function fakePost(response, { status = 200 } = {}) {
  const calls = []
  const impl = async (url, body) => {
    calls.push({ url, body })
    return {
      status,
      body: typeof response === 'string' ? response : JSON.stringify(response),
    }
  }
  impl.calls = calls
  return impl
}

/** Builds a minimal res mock that captures status, headers, and body. */
function fakeRes() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    headersSent: false,
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers
      this.headersSent = true
    },
    end(chunk) {
      if (chunk !== undefined) {
        this.body += chunk
      }
    },
  }
}

function fakeReq(url) {
  return { method: 'GET', url }
}

const validConfig = Object.freeze({
  clientId: 'client-id.apps.googleusercontent.com',
  redirectUri: 'https://example.run.app/redirect',
  secretName: 'projects/p/secrets/s/versions/latest',
})

describe('parseState', () => {
  test('When state is valid JSON with manual=false and a loopback port, then it returns the parsed object', () => {
    const raw = JSON.stringify({ csrf: 'abc', manual: false, loopback_port: 41234 })
    assert.deepEqual(parseState(raw), { csrf: 'abc', manual: false, loopbackPort: 41234 })
  })

  test('When state is valid JSON with manual=true, then loopbackPort is null', () => {
    const raw = JSON.stringify({ csrf: 'abc', manual: true })
    assert.deepEqual(parseState(raw), { csrf: 'abc', manual: true, loopbackPort: null })
  })

  test('When state is missing csrf, then it returns null', () => {
    const raw = JSON.stringify({ manual: false, loopback_port: 41234 })
    assert.equal(parseState(raw), null)
  })

  test('When state has manual=false but no port, then it returns null', () => {
    const raw = JSON.stringify({ csrf: 'abc', manual: false })
    assert.equal(parseState(raw), null)
  })

  test('When state has an out-of-range loopback port, then it returns null', () => {
    const raw = JSON.stringify({ csrf: 'abc', manual: false, loopback_port: 80 })
    assert.equal(parseState(raw), null)
  })

  test('When state is not JSON, then it returns null', () => {
    assert.equal(parseState('not-json'), null)
  })

  test('When state exceeds 4KB, then it returns null', () => {
    const big = JSON.stringify({ csrf: 'a'.repeat(5000), manual: true })
    assert.equal(parseState(big), null)
  })

  test('When state is empty, then it returns null', () => {
    assert.equal(parseState(''), null)
    assert.equal(parseState(null), null)
    assert.equal(parseState(undefined), null)
  })
})

describe('buildCredentials', () => {
  test('When the token response includes a refresh token, then credentials include all five fields', () => {
    const before = Date.now()
    const creds = buildCredentials({
      access_token: 'at',
      refresh_token: 'rt',
      scope: 'a b',
      expires_in: 3600,
      id_token: 'idt',
    })
    assert.equal(creds.access_token, 'at')
    assert.equal(creds.refresh_token, 'rt')
    assert.equal(creds.scope, 'a b')
    assert.equal(creds.id_token, 'idt')
    assert.ok(creds.expiry_date >= before + 3600 * 1000)
    assert.ok(creds.expiry_date <= Date.now() + 3600 * 1000)
  })

  test('When expires_in is missing, then expiry_date is null', () => {
    const creds = buildCredentials({ access_token: 'at' })
    assert.equal(creds.expiry_date, null)
    assert.equal(creds.refresh_token, null)
  })
})

describe('buildLoopbackRedirect', () => {
  test('When credentials and csrf are passed, then URL encodes both as query params', () => {
    const url = buildLoopbackRedirect(41234, { access_token: 'at', refresh_token: 'rt' }, 'csrf-1')
    const parsed = new URL(url)
    assert.equal(parsed.hostname, '127.0.0.1')
    assert.equal(parsed.port, '41234')
    assert.equal(parsed.searchParams.get('state'), 'csrf-1')
    const creds = JSON.parse(parsed.searchParams.get('credentials'))
    assert.deepEqual(creds, { access_token: 'at', refresh_token: 'rt' })
  })
})

describe('renderManualPage', () => {
  test('When rendered, then contains a Copy JSON button and the credentials JSON in a pre block', () => {
    const html = renderManualPage({ access_token: 'at', refresh_token: 'rt' })
    assert.match(html, /Copy JSON/)
    assert.match(html, /<pre id="credentials">/)
    assert.match(html, /&quot;access_token&quot;: &quot;at&quot;/)
    assert.match(html, /navigator\.clipboard\.writeText/)
  })

  test('When credentials contain HTML-unsafe characters, then they are escaped', () => {
    const html = renderManualPage({ access_token: '<script>alert(1)</script>' })
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  })

  test('When the page is rendered, then total size stays under 4KB', () => {
    const html = renderManualPage({ access_token: 'at', refresh_token: 'rt', scope: 'a b c' })
    assert.ok(Buffer.byteLength(html, 'utf8') < 4096, `page size ${Buffer.byteLength(html, 'utf8')} >= 4096`)
  })
})

describe('renderErrorPage', () => {
  test('When given an error code, then the page echoes the escaped code', () => {
    const html = renderErrorPage('access_denied')
    assert.match(html, /access_denied/)
    assert.match(html, /Sign-in failed/)
  })

  test('When the error code contains HTML, then it is escaped', () => {
    const html = renderErrorPage('<img src=x>')
    assert.doesNotMatch(html, /<img src=x>/)
    assert.match(html, /&lt;img src=x&gt;/)
  })

  test('When error code is missing, then a default code is rendered', () => {
    const html = renderErrorPage(null)
    assert.match(html, /unknown_error/)
  })
})

describe('handleRedirect', () => {
  test('When state.manual is false with a valid port, then it 302-redirects to loopback with credentials', async () => {
    const res = fakeRes()
    const state = JSON.stringify({ csrf: 'csrf-1', manual: false, loopback_port: 41234 })
    const req = fakeReq(`/redirect?code=auth-code&state=${encodeURIComponent(state)}`)
    const post = fakePost({
      access_token: 'at',
      refresh_token: 'rt',
      scope: 'a b',
      expires_in: 3600,
    })
    await handleRedirect(req, res, {
      config: validConfig,
      loadSecret: async () => 'shhh',
      post,
    })
    assert.equal(res.statusCode, 302)
    const location = res.headers.location
    const parsed = new URL(location)
    assert.equal(parsed.hostname, '127.0.0.1')
    assert.equal(parsed.port, '41234')
    assert.equal(parsed.searchParams.get('state'), 'csrf-1')
    const creds = JSON.parse(parsed.searchParams.get('credentials'))
    assert.equal(creds.refresh_token, 'rt')
    assert.equal(creds.access_token, 'at')
    assert.equal(post.calls.length, 1)
    assert.equal(post.calls[0].url, 'https://oauth2.googleapis.com/token')
  })

  test('When state.manual is true, then it renders the manual page with the credentials JSON', async () => {
    const res = fakeRes()
    const state = JSON.stringify({ csrf: 'csrf-1', manual: true })
    const req = fakeReq(`/redirect?code=auth-code&state=${encodeURIComponent(state)}`)
    const post = fakePost({
      access_token: 'at',
      refresh_token: 'rt',
      scope: 'a b',
      expires_in: 3600,
    })
    await handleRedirect(req, res, {
      config: validConfig,
      loadSecret: async () => 'shhh',
      post,
    })
    assert.equal(res.statusCode, 200)
    assert.match(res.body, /Copy JSON/)
    assert.match(res.body, /&quot;refresh_token&quot;: &quot;rt&quot;/)
  })

  test('When state is missing, then it falls back to the manual page', async () => {
    const res = fakeRes()
    const req = fakeReq(`/redirect?code=auth-code`)
    const post = fakePost({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 })
    await handleRedirect(req, res, {
      config: validConfig,
      loadSecret: async () => 'shhh',
      post,
    })
    assert.equal(res.statusCode, 200)
    assert.match(res.body, /Copy JSON/)
  })

  test('When the request carries ?error=access_denied, then a 400 error page is rendered without calling the token endpoint', async () => {
    const res = fakeRes()
    const req = fakeReq(`/redirect?error=access_denied`)
    const post = fakePost({})
    await handleRedirect(req, res, {
      config: validConfig,
      loadSecret: async () => 'shhh',
      post,
    })
    assert.equal(res.statusCode, 400)
    assert.match(res.body, /access_denied/)
    assert.equal(post.calls.length, 0)
  })

  test('When the code is missing and no error is set, then a 400 is returned', async () => {
    const res = fakeRes()
    const req = fakeReq(`/redirect`)
    await handleRedirect(req, res, {
      config: validConfig,
      loadSecret: async () => 'shhh',
      post: fakePost({}),
    })
    assert.equal(res.statusCode, 400)
  })

  test('When the token endpoint returns 400, then a 502 is returned and no secret leaks into the body', async () => {
    const res = fakeRes()
    const req = fakeReq(`/redirect?code=bad-code`)
    const post = fakePost('{"error":"invalid_grant"}', { status: 400 })
    await handleRedirect(req, res, {
      config: validConfig,
      loadSecret: async () => 'super-secret-value',
      post,
    })
    assert.equal(res.statusCode, 502)
    assert.doesNotMatch(res.body, /super-secret-value/)
  })

  test('When the service is missing required env vars, then a 503 is returned', async () => {
    const res = fakeRes()
    const req = fakeReq(`/redirect?code=auth-code`)
    await handleRedirect(req, res, {
      config: { clientId: null, redirectUri: null, secretName: null },
      loadSecret: async () => 'shhh',
      post: fakePost({}),
    })
    assert.equal(res.statusCode, 503)
  })

  test('When state has manual=false but a junk port, then it falls back to the manual page rather than redirecting', async () => {
    const res = fakeRes()
    const state = JSON.stringify({ csrf: 'csrf-1', manual: false, loopback_port: 'not-a-port' })
    const req = fakeReq(`/redirect?code=auth-code&state=${encodeURIComponent(state)}`)
    const post = fakePost({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 })
    await handleRedirect(req, res, {
      config: validConfig,
      loadSecret: async () => 'shhh',
      post,
    })
    assert.equal(res.statusCode, 200)
    assert.match(res.body, /Copy JSON/)
  })
})
