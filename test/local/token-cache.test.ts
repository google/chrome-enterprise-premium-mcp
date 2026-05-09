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
import { TokenCache } from '../../lib/util/credential/token_cache.js'

describe('TokenCache', () => {
  it('When write is called, then the file has mode 0600', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-test-'))
    const cache = new TokenCache(path.join(dir, 'tokens.json'))
    await cache.write({ access_token: 'a', refresh_token: 'r', expiry_date: 0, scopes: [] })
    const stat = await fs.stat(path.join(dir, 'tokens.json'))
    assert.equal(stat.mode & 0o777, 0o600)
  })

  it('When read is called and the file does not exist, then it returns null', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-test-'))
    const cache = new TokenCache(path.join(dir, 'tokens.json'))
    assert.equal(await cache.read(), null)
  })

  it('When write is called with a path whose parent directory does not exist, then the directory is created', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-test-'))
    const cache = new TokenCache(path.join(dir, 'nested', 'sub', 'tokens.json'))
    await cache.write({ access_token: 'a' })
    const stat = await fs.stat(path.join(dir, 'nested', 'sub', 'tokens.json'))
    assert.ok(stat.isFile())
  })

  it('When write then read, then the round-trip preserves access_token, expiry_date, and scope', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-test-'))
    const cache = new TokenCache(path.join(dir, 'tokens.json'))
    const input = { access_token: 'a', expiry_date: 12345, scope: 'x y z' }
    await cache.write(input)
    assert.deepEqual(await cache.read(), input)
  })

  it('When the input includes a refresh_token, then write strips it before persisting', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-test-'))
    const cache = new TokenCache(path.join(dir, 'tokens.json'))
    await cache.write({
      access_token: 'a',
      refresh_token: 'must-not-persist',
      expiry_date: 12345,
      scope: 'x',
    })
    const persisted = await cache.read()
    assert.equal(persisted.refresh_token, undefined, 'refresh_token must not be persisted')
    assert.equal(persisted.access_token, 'a')
    assert.equal(persisted.scope, 'x')
  })

  it('When the existing file has mode 0644, then write tightens it to 0600', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-test-'))
    const filePath = path.join(dir, 'tokens.json')
    await fs.writeFile(filePath, '{}', { mode: 0o644 })
    const cache = new TokenCache(filePath)
    await cache.write({ access_token: 'a' })
    const stat = await fs.stat(filePath)
    assert.equal(stat.mode & 0o777, 0o600)
  })

  it('When modeIsTight is called on a 0600 file, then it returns true', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-test-'))
    const cache = new TokenCache(path.join(dir, 'tokens.json'))
    await cache.write({ access_token: 'a' })
    assert.equal(await cache.modeIsTight(), true)
  })

  it('When modeIsTight is called on a 0644 file, then it returns false', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-test-'))
    const filePath = path.join(dir, 'tokens.json')
    await fs.writeFile(filePath, '{}', { mode: 0o644 })
    const cache = new TokenCache(filePath)
    assert.equal(await cache.modeIsTight(), false)
  })

  it('When defaultPath is called on Linux/macOS, then it returns ~/.config/cep-mcp/tokens.json', () => {
    if (process.platform === 'win32') {
      return // skip on Windows
    }
    assert.equal(TokenCache.defaultPath(), path.join(process.env.HOME, '.config', 'cep-mcp', 'tokens.json'))
  })
})
