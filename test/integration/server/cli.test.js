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
 * @file Tests for bin/cli.js subcommand dispatch and runLoginCommand.
 */

import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.resolve(__dirname, '../../../bin/cli.js')

describe('bin/cli.js', () => {
  describe('auth-status', () => {
    it('When invoked with auth-status and ADC absent, then it prints the ADC line and an OAuth flow line', () => {
      const result = spawnSync('node', [CLI, 'auth-status'], {
        encoding: 'utf8',
        env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: '/nonexistent' },
      })
      assert.equal(result.status, 0)
      assert.match(result.stdout, /Auth status:/)
      assert.match(result.stdout, /ADC:/)
      assert.match(result.stdout, /OAuth flow:/)
    })
  })
})

describe('runLoginCommand', () => {
  it('When login is invoked and runLoginFlow succeeds, then it prints the cached message and exits 0', async () => {
    const { runLoginCommand } = await import('../../../lib/util/credential/cli_commands.js')

    const runLoginFlow = mock.fn(async () => {})
    const credentialFactory = mock.fn(() => ({ runLoginFlow }))
    const configResolver = mock.fn(() => ({ source: 'managed', clientId: '', clientSecret: '' }))

    const lines = []

    const origLog = console.log

    console.log = msg => {
      lines.push(msg)
    }
    try {
      await runLoginCommand({ credentialFactory, configResolver })
    } finally {
      // eslint-disable-next-line require-atomic-updates
      console.log = origLog
    }

    assert.equal(credentialFactory.mock.calls.length, 1)
    assert.equal(runLoginFlow.mock.calls.length, 1)
    assert.ok(lines.some(l => /tokens cached/i.test(l)))
  })
})

describe('runLoginCommand BYO notice', () => {
  it('When source is managed, then no notice prints', async () => {
    const { runLoginCommand } = await import('../../../lib/util/credential/cli_commands.js')

    const runLoginFlow = mock.fn(async () => {})
    const credentialFactory = mock.fn(() => ({ runLoginFlow }))
    const configResolver = mock.fn(() => ({
      source: 'managed',
      clientId: '',
      clientSecret: '',
    }))

    const lines = []

    const origLog = console.log

    console.log = msg => {
      lines.push(msg)
    }
    try {
      await runLoginCommand({ credentialFactory, configResolver })
    } finally {
      // eslint-disable-next-line require-atomic-updates
      console.log = origLog
    }

    const noticePresent = lines.some(l => /Custom OAuth client detected/i.test(l))
    assert.equal(noticePresent, false)
  })

  it('When source is custom and no marker exists, then notice prints and marker is created', async () => {
    const { runLoginCommand } = await import('../../../lib/util/credential/cli_commands.js')
    const fs = await import('node:fs/promises')
    const os = await import('node:os')
    const path = await import('node:path')

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-test-'))
    const noticePath = path.join(tmpDir, 'byo-notice.shown')

    const runLoginFlow = mock.fn(async () => {})
    const credentialFactory = mock.fn(() => ({ runLoginFlow }))
    const configResolver = mock.fn(() => ({
      source: 'custom',
      clientId: 'test',
      clientSecret: 'test',
    }))

    const lines = []

    const origLog = console.log

    console.log = msg => {
      lines.push(msg)
    }
    try {
      await runLoginCommand({ credentialFactory, noticePath, configResolver })
    } finally {
      // eslint-disable-next-line require-atomic-updates
      console.log = origLog
      await fs.rm(tmpDir, { recursive: true, force: true })
    }

    const noticePresent = lines.some(l => /Custom OAuth client detected/i.test(l))
    assert.equal(noticePresent, true)
  })

  it('When source is custom and marker exists, then notice does not print', async () => {
    const { runLoginCommand } = await import('../../../lib/util/credential/cli_commands.js')
    const fs = await import('node:fs/promises')
    const os = await import('node:os')
    const path = await import('node:path')

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cep-mcp-test-'))
    const noticePath = path.join(tmpDir, 'byo-notice.shown')

    // Pre-create marker
    await fs.mkdir(path.dirname(noticePath), { recursive: true })
    await fs.writeFile(noticePath, new Date().toISOString())

    const runLoginFlow = mock.fn(async () => {})
    const credentialFactory = mock.fn(() => ({ runLoginFlow }))
    const configResolver = mock.fn(() => ({
      source: 'custom',
      clientId: 'test',
      clientSecret: 'test',
    }))

    const lines = []

    const origLog = console.log

    console.log = msg => {
      lines.push(msg)
    }
    try {
      await runLoginCommand({ credentialFactory, noticePath, configResolver })
    } finally {
      // eslint-disable-next-line require-atomic-updates
      console.log = origLog
      await fs.rm(tmpDir, { recursive: true, force: true })
    }

    const noticePresent = lines.some(l => /Custom OAuth client detected/i.test(l))
    assert.equal(noticePresent, false)
  })
})
