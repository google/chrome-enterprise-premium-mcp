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

<<<<<<< HEAD
=======
/**
 * @file Unit tests for the CLI entry point (bin/cli.js).
 */

>>>>>>> auth-task26
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
<<<<<<< HEAD

const CLI = path.resolve('bin/cli.js')

describe('bin/cli.js', () => {
  it('When invoked with login subcommand, then it exits 1 with a not-yet-implemented message', () => {
    const result = spawnSync('node', [CLI, 'login'], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /not yet implemented/i)
  })

  it('When invoked with auth-status subcommand, then it exits 1 with a not-yet-implemented message', () => {
    const result = spawnSync('node', [CLI, 'auth-status'], { encoding: 'utf8' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /not yet implemented/i)
=======
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.resolve(__dirname, '../../bin/cli.js')

describe('cli.js', () => {
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

  describe('login', () => {
    it('When invoked with login, then it exits 1 with not yet implemented', () => {
      const result = spawnSync('node', [CLI, 'login'], { encoding: 'utf8' })
      assert.equal(result.status, 1)
      assert.match(result.stderr, /not yet implemented/)
    })
>>>>>>> auth-task26
  })
})
