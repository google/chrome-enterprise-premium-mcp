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
import { startLoopbackServer } from '../../lib/util/credential/loopback_server.js'

describe('startLoopbackServer', () => {
  it('When start is called, then it binds to 127.0.0.1 with a random port', async () => {
    const server = await startLoopbackServer()
    try {
      assert.match(server.redirectUri, /^http:\/\/127\.0\.0\.1:\d+\/$/)
    } finally {
      await server.stop()
    }
  })

  it('When the redirect URI is hit with ?code=abc, then waitForCode resolves with abc', async () => {
    const server = await startLoopbackServer()
    try {
      const codePromise = server.waitForCode()
      await fetch(`${server.redirectUri}?code=abc&state=xyz`)
      const { code, state } = await codePromise
      assert.equal(code, 'abc')
      assert.equal(state, 'xyz')
    } finally {
      await server.stop()
    }
  })

  it('When the redirect URI is hit with ?error=access_denied, then waitForCode resolves with the error', async () => {
    const server = await startLoopbackServer()
    try {
      const codePromise = server.waitForCode()
      await fetch(`${server.redirectUri}?error=access_denied`)
      const result = await codePromise
      assert.equal(result.error, 'access_denied')
    } finally {
      await server.stop()
    }
  })

  it('When the loopback receives a request, then the response body is human-readable HTML', async () => {
    const server = await startLoopbackServer()
    try {
      server.waitForCode()
      const res = await fetch(`${server.redirectUri}?code=test`)
      assert.equal(res.status, 200)
      const body = await res.text()
      assert.match(body, /You may close this window/i)
    } finally {
      await server.stop()
    }
  })
})
