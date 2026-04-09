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

/* eslint-disable n/no-process-exit */

/**
 * @fileoverview Runs all local unit tests via the Node.js test runner.
 *
 * Discovers `.test.js` files under `test/local/` using a recursive directory
 * walk so that glob expansion is not required (works on Windows and POSIX).
 *
 * Usage: node test/run-unit.js
 */

import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { findTestFiles } from './run-utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const testFiles = findTestFiles(join(root, 'test', 'local')).sort()

if (testFiles.length === 0) {
  console.error('No test files found under test/local/')
  process.exit(1)
}

console.log(`Running ${testFiles.length} unit test file(s)...\n`)

try {
  execFileSync(process.execPath, ['--test', ...testFiles], {
    cwd: root,
    stdio: 'inherit',
  })
} catch {
  process.exit(1)
}
