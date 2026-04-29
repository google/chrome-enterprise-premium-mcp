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
import { spawnSync } from 'node:child_process'
import path from 'node:path'

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
  })
})
