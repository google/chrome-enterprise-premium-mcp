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

import { readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/**
 * Recursively finds all files ending with `.test.js` under the given directory.
 *
 * @param {string} dir - Absolute path to the directory to search.
 * @returns {string[]} Absolute paths of discovered test files.
 */
function findTestFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findTestFiles(full))
    } else if (entry.name.endsWith('.test.js')) {
      results.push(full)
    }
  }
  return results
}

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
