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
 * @file Verifies that the /mcp and /sse handler factories in mcp-server.js
 * construct a fresh sessionState per request and pass distinct references
 * to getServer — the regression this PR fixes. Uses dependency injection on
 * getServer so we observe the actual handler code path without needing the
 * MCP SDK transports or a real express server.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { createSessionState, createMcpPostHandler, createSseHandler } from '../../mcp-server.js'

const fakeMcpServer = {
  connect: async () => {},
  close: () => {},
}

function makeRecorder() {
  const captured = []
  const fn = async (_gcpInfo, sessionState) => {
    captured.push(sessionState)
    return fakeMcpServer
  }
  return { fn, captured }
}

describe('HTTP per-request session state isolation', () => {
  test('createSessionState returns a fresh, distinct object on every call', () => {
    const a = createSessionState()
    const b = createSessionState()
    assert.notStrictEqual(a, b)
    assert.deepStrictEqual(a, {
      customerId: null,
      cachedRootOrgUnitId: null,
      pendingRule: null,
      history: [],
    })
    a.customerId = 'C0AAAAAAA'
    assert.strictEqual(b.customerId, null, 'mutating one must not bleed into the other')
  })

  test('createMcpPostHandler passes a distinct sessionState to getServer per request', async () => {
    const { fn: recorder, captured } = makeRecorder()
    const handler = createMcpPostHandler({}, recorder)
    const fakeReq = { body: {}, on: () => {} }
    const fakeRes = { on: () => {}, headersSent: false, status: () => fakeRes, json: () => {} }

    await handler(fakeReq, fakeRes)
    await handler(fakeReq, fakeRes)

    assert.strictEqual(captured.length, 2, 'getServer must be called once per request')
    assert.notStrictEqual(captured[0], captured[1], 'each request must get a distinct sessionState reference')
    captured[0].customerId = 'C0TENANT1'
    assert.strictEqual(captured[1].customerId, null, 'cross-tenant cache must not leak')
  })

  test('createSseHandler passes a distinct sessionState to getServer per request', async () => {
    const { fn: recorder, captured } = makeRecorder()
    const sseTransports = {}
    const handler = createSseHandler({}, sseTransports, recorder)
    const fakeRes = { on: () => {}, headersSent: false }

    await handler({}, fakeRes)
    await handler({}, fakeRes)

    assert.strictEqual(captured.length, 2)
    assert.notStrictEqual(captured[0], captured[1])
    captured[0].customerId = 'C0TENANT1'
    assert.strictEqual(captured[1].customerId, null)
  })
})
