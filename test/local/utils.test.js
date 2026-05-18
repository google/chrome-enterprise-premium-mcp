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

/* eslint-disable require-atomic-updates */
import assert from 'node:assert/strict'
import { describe, test, mock } from 'node:test'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { commonTransform, guardedToolCall } from '../../tools/utils/wrapper.js'
import { validateAndGetOrgUnitId } from '../../tools/utils/org-unit.js'
import { formatStatus } from '../../lib/util/helpers.js'
import { SCOPES } from '../../lib/constants.js'

describe('Tool Utils', () => {
  describe('commonTransform', () => {
    test('When orgUnitId has id: prefix, then it strips it', () => {
      const params = { orgUnitId: 'id:123', other: 'val' }
      const result = commonTransform(params)
      assert.strictEqual(result.orgUnitId, '123')
      assert.strictEqual(result.other, 'val')
    })

    test('When other parameters are provided, then it does not modify them', () => {
      const params = { customerId: 'C123', foo: 'bar' }
      const result = commonTransform(params)
      assert.strictEqual(result.customerId, 'C123')
      assert.strictEqual(result.foo, 'bar')
    })
  })

  describe('validateAndGetOrgUnitId', () => {
    test('When ID does not start with "id:", then it returns the same ID', () => {
      assert.strictEqual(validateAndGetOrgUnitId('123'), '123')
    })

    test('When ID starts with "id:", then it strips the prefix', () => {
      assert.strictEqual(validateAndGetOrgUnitId('id:123'), '123')
    })
  })

  describe('guardedToolCall Infrastructure', () => {
    describe('Registration and Auto-Resolution', () => {
      test('When tools are registered, then it auto-resolves customerId using provided adminSdk client and apiOptions', async () => {
        const handler = mock.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))
        const mockGetCustomerId = mock.fn(async () => ({ id: 'C_AUTO' }))
        const apiClients = { adminSdk: { getCustomerId: mockGetCustomerId } }
        const sessionState = { customerId: null }
        const tool = guardedToolCall({ handler }, { apiClients }, sessionState)

        await tool({}, { requestInfo: { headers: { authorization: 'Bearer fake' } } })
        assert.strictEqual(mockGetCustomerId.mock.callCount(), 1)
        assert.strictEqual(sessionState.customerId, 'C_AUTO')
      })
    })

    describe('Caching logic integration', () => {
      test('When params.customerId is provided, then it updates sessionState.customerId', async () => {
        const handler = mock.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))
        const sessionState = { customerId: null }
        const tool = guardedToolCall({ handler }, {}, sessionState)
        await tool({ customerId: 'C_EXPLICIT' }, { requestInfo: { headers: { authorization: 'Bearer fake' } } })
        assert.strictEqual(sessionState.customerId, 'C_EXPLICIT')
      })
    })

    test('When handler fails with 401 and no inbound bearer, then it points the user at `mcp auth login`', async () => {
      const err = new Error('UNAUTHENTICATED')
      err.status = 401
      const failHandler = mock.fn(async () => {
        throw err
      })
      const tool = guardedToolCall({ handler: failHandler })
      const result = await tool({}, {})
      assert.strictEqual(result.isError, true)
      assert.match(result.content[0].text, /mcp auth login/)
    })

    test('When handler fails with 403 and no inbound bearer, then it lists `mcp auth login` and the required APIs', async () => {
      const err = new Error('PERMISSION_DENIED')
      err.status = 403
      const failHandler = mock.fn(async () => {
        throw err
      })
      const tool = guardedToolCall({ handler: failHandler })
      const result = await tool({}, {})
      assert.strictEqual(result.isError, true)
      assert.match(result.content[0].text, /mcp auth login/)
      assert.match(result.content[0].text, /APIs are enabled/)
    })

    test('When handler fails with invalid_grant, then it points the user at `mcp auth login`', async () => {
      const err = new Error('invalid_grant')
      const failHandler = mock.fn(async () => {
        throw err
      })
      const tool = guardedToolCall({ handler: failHandler })
      const result = await tool({}, {})
      assert.strictEqual(result.isError, true)
      assert.match(result.content[0].text, /mcp auth login/)
    })

    test('When handler fails with 401 and an inbound Bearer token is present, then the remediation tells the caller to refresh the inbound token', async () => {
      const err = new Error('UNAUTHENTICATED')
      err.status = 401
      const failHandler = mock.fn(async () => {
        throw err
      })
      const tool = guardedToolCall({ handler: failHandler })
      const result = await tool({}, { requestInfo: { headers: { authorization: 'Bearer abc' } } })
      assert.strictEqual(result.isError, true)
      assert.match(result.content[0].text, /inbound Bearer token/)
    })

    test('When handler fails with 403 and an inbound Bearer token is present, then the remediation tells the caller to refresh the inbound token', async () => {
      const err = new Error('PERMISSION_DENIED')
      err.status = 403
      const failHandler = mock.fn(async () => {
        throw err
      })
      const tool = guardedToolCall({ handler: failHandler })
      const result = await tool({}, { requestInfo: { headers: { authorization: 'Bearer abc' } } })
      assert.strictEqual(result.isError, true)
      assert.match(result.content[0].text, /inbound Bearer token/)
    })

    test('When onError is provided and handler fails, then it calls onError', async () => {
      const err = new Error('Boom')
      const failHandler = mock.fn(async () => {
        throw err
      })
      const onError = mock.fn(() => ({ content: [{ type: 'text', text: 'custom' }], isError: true }))
      const tool = guardedToolCall({ handler: failHandler }, { onError })
      const result = await tool({}, { requestInfo: { headers: { authorization: 'Bearer fake' } } })
      assert.strictEqual(result.isError, true)
      assert.strictEqual(result.content[0].text, 'custom')
      assert.strictEqual(onError.mock.callCount(), 1)
    })
  })

  describe('guardedToolCall Auth Pre-flight', () => {
    test('When guardedToolCall runs with no inbound Bearer and no cached token, then it returns an authRequired response and does not invoke the handler', async () => {
      const handler = mock.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))
      const homeKey = process.platform === 'win32' ? 'APPDATA' : 'HOME'
      const saved = process.env[homeKey]
      const savedSsh = process.env.SSH_CONNECTION
      const emptyHome = path.join(
        os.tmpdir(),
        `cep-mcp-empty-home-${process.pid}-${Math.random().toString(16).slice(2)}`,
      )

      await fs.mkdir(emptyHome, { recursive: true })
      // Use Object.assign to bypass require-atomic-updates false positives in tests
      Object.assign(process.env, { [homeKey]: emptyHome, SSH_CONNECTION: 'true' })

      try {
        const tool = guardedToolCall({ handler })
        const result = await tool({}, {})
        assert.strictEqual(result.isError, true)
        assert.match(result.content[0].text, /Sign-in is needed/)
        assert.match(result.content[0].text, /token is missing/)
        assert.match(result.content[0].text, /cep_auth/)
        assert.ok(!result.structuredContent)
        assert.strictEqual(handler.mock.callCount(), 0)
      } finally {
        if (saved === undefined) {
          delete process.env[homeKey]
        } else {
          process.env[homeKey] = saved
        }

        if (savedSsh === undefined) {
          delete process.env.SSH_CONNECTION
        } else {
          process.env.SSH_CONNECTION = savedSsh
        }

        await fs.rm(emptyHome, { recursive: true, force: true })
      }
    })

    test('When guardedToolCall runs with no inbound Bearer and an expired cached token, then the authRequired response carries reason=expired and the expiry timestamp', async () => {
      const handler = mock.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))
      const homeKey = process.platform === 'win32' ? 'APPDATA' : 'HOME'
      const saved = process.env[homeKey]
      const savedSsh = process.env.SSH_CONNECTION
      const home = path.join(os.tmpdir(), `cep-mcp-expired-home-${process.pid}-${Math.random().toString(16).slice(2)}`)
      const cacheDir = process.platform === 'win32' ? path.join(home, 'cep-mcp') : path.join(home, '.config', 'cep-mcp')
      const cachePath = path.join(cacheDir, 'tokens.json')
      const expiredAt = Date.now() - 60_000
      const expiredAtIso = new Date(expiredAt).toISOString()

      await fs.mkdir(cacheDir, { recursive: true })
      await fs.writeFile(cachePath, JSON.stringify({ access_token: 'stale', expiry_date: expiredAt }), { mode: 0o600 })

      // Use Object.assign to bypass require-atomic-updates false positives in tests
      Object.assign(process.env, { [homeKey]: home, SSH_CONNECTION: 'true' })

      try {
        const tool = guardedToolCall({ handler })
        const result = await tool({}, {})
        assert.strictEqual(result.isError, true)
        assert.match(result.content[0].text, /expired/)
        assert.match(result.content[0].text, new RegExp(expiredAtIso))
        assert.ok(!result.structuredContent)
        assert.strictEqual(handler.mock.callCount(), 0)
      } finally {
        if (saved === undefined) {
          delete process.env[homeKey]
        } else {
          process.env[homeKey] = saved
        }

        if (savedSsh === undefined) {
          delete process.env.SSH_CONNECTION
        } else {
          process.env.SSH_CONNECTION = savedSsh
        }

        await fs.rm(home, { recursive: true, force: true })
      }
    })

    test('When guardedToolCall runs with an inbound Bearer token and no cache, then it skips the pre-flight and invokes the handler', async () => {
      const handler = mock.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))
      const homeKey = process.platform === 'win32' ? 'APPDATA' : 'HOME'
      const saved = process.env[homeKey]
      const emptyHome = path.join(
        os.tmpdir(),
        `cep-mcp-empty-home-${process.pid}-${Math.random().toString(16).slice(2)}`,
      )

      await fs.mkdir(emptyHome, { recursive: true })
      process.env[homeKey] = emptyHome

      try {
        const tool = guardedToolCall({ handler })
        const result = await tool({}, { requestInfo: { headers: { authorization: 'Bearer fake' } } })
        assert.strictEqual(result.content[0].text, 'ok')
        assert.strictEqual(handler.mock.callCount(), 1)
      } finally {
        if (saved === undefined) {
          delete process.env[homeKey]
        } else {
          process.env[homeKey] = saved
        }

        await fs.rm(emptyHome, { recursive: true, force: true })
      }
    })

    test('When guardedToolCall runs with no inbound Bearer and a fresh cached token, then it invokes the handler', async () => {
      const handler = mock.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))
      const homeKey = process.platform === 'win32' ? 'APPDATA' : 'HOME'
      const saved = process.env[homeKey]
      const home = path.join(os.tmpdir(), `cep-mcp-fresh-home-${process.pid}-${Math.random().toString(16).slice(2)}`)
      const cacheDir = process.platform === 'win32' ? path.join(home, 'cep-mcp') : path.join(home, '.config', 'cep-mcp')
      const cachePath = path.join(cacheDir, 'tokens.json')

      await fs.mkdir(cacheDir, { recursive: true })
      await fs.writeFile(
        cachePath,
        JSON.stringify({
          access_token: 'fresh',
          expiry_date: Date.now() + 60_000,
          scope: Object.values(SCOPES).join(' '),
        }),
        {
          mode: 0o600,
        },
      )

      process.env[homeKey] = home

      try {
        const tool = guardedToolCall({ handler })
        const result = await tool({}, {})
        assert.strictEqual(result.content[0].text, 'ok')
        assert.strictEqual(handler.mock.callCount(), 1)
      } finally {
        if (saved === undefined) {
          delete process.env[homeKey]
        } else {
          process.env[homeKey] = saved
        }

        await fs.rm(home, { recursive: true, force: true })
      }
    })
  })

  describe('Tool Utils - formatStatus', () => {
    test('When input is null or undefined, then it returns "Unknown"', () => {
      assert.strictEqual(formatStatus(null), 'Unknown')
      assert.strictEqual(formatStatus(undefined), 'Unknown')
    })

    test('When input is in SNAKE_CASE, then it is converted to Title Case with spaces', () => {
      assert.strictEqual(formatStatus('ACTIVE_POLICY'), 'Active Policy')
      assert.strictEqual(formatStatus('NOT_CONFIGURED'), 'Not Configured')
    })

    test('When input is already Title Case or mixed case, then it is normalized correctly', () => {
      assert.strictEqual(formatStatus('ActivePolicy'), 'Activepolicy')
      assert.strictEqual(formatStatus('active'), 'Active')
    })

    test('When input contains multiple underscores, then they are all replaced with spaces', () => {
      assert.strictEqual(formatStatus('A_B_C'), 'A B C')
    })

    test('When input is not a string, then it is converted to a string and formatted', () => {
      assert.strictEqual(formatStatus(123), '123')
    })
  })
})
