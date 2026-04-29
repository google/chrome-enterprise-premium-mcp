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

import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const CLI = path.resolve('bin/cli.js')

describe('bin/cli.js', () => {
  it('When invoked with auth-status subcommand, then it exits 1 with a not-yet-implemented message', () => {
    const result = spawnSync('node', [CLI, 'auth-status'], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /not yet implemented/i)
  })
})

describe('runLoginCommand', () => {
  it('When login is invoked and runLoginFlow succeeds, then it prints the cached message and exits 0', async () => {
    const { runLoginCommand } = await import('../../lib/util/credential/cli_commands.js')

    const runLoginFlow = mock.fn(async () => {})
    const credentialFactory = mock.fn(() => ({ runLoginFlow }))

    const lines = []
    const origLog = console.log
    console.log = (msg) => lines.push(msg)
    try {
      await runLoginCommand({ credentialFactory })
    } finally {
      console.log = origLog
    }

    assert.equal(credentialFactory.mock.calls.length, 1)
    assert.equal(runLoginFlow.mock.calls.length, 1)
    assert.ok(lines.some(l => /opening browser/i.test(l)))
    assert.ok(lines.some(l => /tokens cached/i.test(l)))
  })
})
