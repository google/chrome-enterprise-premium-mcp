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
 * @file Tests the OAuth-cache fallback path of getAuthClient. Mocks GoogleAuth
 * so ADC genuinely throws; the cache file at ~/.config/cep-mcp/tokens.json is
 * backed up before each run and restored after.
 */

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import esmock from 'esmock'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const CACHE_PATH = path.join(os.homedir(), '.config', 'cep-mcp', 'tokens.json')
const SAVED_PATH = path.join(os.tmpdir(), `cep-tokens-saved-${process.pid}.json`)
const SYNTHETIC_TOKEN = 'ya29.SYNTHETIC_TEST_TOKEN'

describe('getAuthClient OAuth-cache fallback', () => {
  before(async () => {
    try {
      await fs.copyFile(CACHE_PATH, SAVED_PATH)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err
      }
    }
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true })
    await fs.writeFile(
      CACHE_PATH,
      JSON.stringify({
        access_token: SYNTHETIC_TOKEN,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/userinfo.email',
        expiry_date: Date.now() + 3600 * 1000,
      }),
      { mode: 0o600 },
    )
  })

  after(async () => {
    try {
      await fs.copyFile(SAVED_PATH, CACHE_PATH)
      await fs.unlink(SAVED_PATH)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err
      }
      await fs.unlink(CACHE_PATH).catch(() => {})
    }
  })

  test('returns OAuth2Client populated from token cache when ADC throws', async () => {
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        GoogleAuth: class {
          async getClient() {
            throw new Error('SYNTHETIC: ADC unavailable')
          }
        },
        OAuth2Client: class {
          constructor() {
            this._creds = null
          }
          setCredentials(c) {
            this._creds = c
          }
          async getAccessToken() {
            return { token: this._creds?.access_token }
          }
        },
      },
    })

    const { client, source } = await getAuthClient(['https://www.googleapis.com/auth/userinfo.email'], undefined)
    assert.ok(client, 'returned a client')
    assert.strictEqual(source, 'cache', 'source should be cache')
    const tok = await client.getAccessToken()
    assert.equal(tok.token, SYNTHETIC_TOKEN, 'returned cached token')
  })

  test('returns OAuth2Client populated from token cache when ADC getAccessToken throws', async () => {
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        GoogleAuth: class {
          async getClient() {
            return {
              getAccessToken: async () => {
                throw new Error('SYNTHETIC: Token retrieval failed')
              },
            }
          }
        },
        OAuth2Client: class {
          constructor() {
            this._creds = null
          }
          setCredentials(c) {
            this._creds = c
          }
          async getAccessToken() {
            return { token: this._creds?.access_token }
          }
        },
      },
    })

    const { client, source } = await getAuthClient(['https://www.googleapis.com/auth/userinfo.email'], undefined)
    assert.ok(client, 'returned a client')
    assert.strictEqual(source, 'cache', 'source should be cache')
    const tok = await client.getAccessToken()
    assert.equal(tok.token, SYNTHETIC_TOKEN, 'returned cached token')
  })

  test('returns OAuth2Client populated from token cache when ADC getAccessToken throws', async () => {
    const { getAuthClient } = await esmock('../../lib/util/auth.js', {
      'google-auth-library': {
        GoogleAuth: class {
          async getClient() {
            return {
              getAccessToken: async () => {
                throw new Error('SYNTHETIC: Token retrieval failed')
              },
            }
          }
        },
        OAuth2Client: class {
          constructor() {
            this._creds = null
          }
          setCredentials(c) {
            this._creds = c
          }
          async getAccessToken() {
            return { token: this._creds?.access_token }
          }
        },
      },
    })

    const { client, source } = await getAuthClient(['https://www.googleapis.com/auth/userinfo.email'], undefined)
    assert.ok(client, 'returned a client')
    assert.strictEqual(source, 'cache', 'source should be cache')
    const tok = await client.getAccessToken()
    assert.equal(tok.token, SYNTHETIC_TOKEN, 'returned cached token')
  })

  test('When ADC throws and the cache file has mode 0644, then getAuthClient throws with a chmod hint', async t => {
    if (process.platform === 'win32') {
      return t.skip('mode bits are meaningless on Windows ACLs')
    }
    await fs.chmod(CACHE_PATH, 0o644)
    try {
      const { getAuthClient } = await esmock('../../lib/util/auth.js', {
        'google-auth-library': {
          GoogleAuth: class {
            async getClient() {
              throw new Error('SYNTHETIC: ADC unavailable')
            }
          },
          OAuth2Client: class {
            constructor() {
              this._creds = null
            }
            setCredentials(c) {
              this._creds = c
            }
          },
        },
      })

      await assert.rejects(
        () => getAuthClient(['https://www.googleapis.com/auth/userinfo.email'], undefined),
        /loose permissions.*chmod 600/s,
      )
    } finally {
      await fs.chmod(CACHE_PATH, 0o600).catch(() => {})
    }
  })
})
