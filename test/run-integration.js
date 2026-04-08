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
 * @fileoverview Runs integration tests via the Node.js test runner.
 *
 * Accepts a positional argument ("fake" or "real") that determines the
 * CEP_BACKEND environment variable. Defaults to "fake" when omitted.
 *
 * Discovers `.test.js` files under `test/integration/tools/` using a recursive
 * directory walk so that glob expansion is not required (works on Windows and
 * POSIX).
 *
 * Usage:
 *   node test/run-integration.js fake
 *   node test/run-integration.js real
 */

import { readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const backend = process.argv[2] || 'fake'

if (backend !== 'fake' && backend !== 'real') {
  console.error(`Unknown backend: "${backend}". Expected "fake" or "real".`)
  process.exit(1)
}

process.env.CEP_BACKEND = backend

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

const testFiles = findTestFiles(join(root, 'test', 'integration', 'tools')).sort()

if (testFiles.length === 0) {
  console.error('No test files found under test/integration/tools/')
  process.exit(1)
}

console.log(`Running ${testFiles.length} integration test file(s) with CEP_BACKEND=${backend}...\n`)

try {
  execFileSync(process.execPath, ['--test', ...testFiles], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
} catch {
  process.exit(1)
}
