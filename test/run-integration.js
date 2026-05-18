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
 * @file Runs integration tests via the Node.js test runner.
 *
 * Accepts a positional argument ("fake" or "real") that determines the
 * CEP_BACKEND environment variable. Defaults to "fake" when omitted.
 *
 * Discovers `.test.js` files under `test/integration/tools/` and
 * `test/integration/server/` using a recursive directory walk so that glob
 * expansion is not required (works on Windows and POSIX).
 *
 * Usage:
 *   node test/run-integration.js fake
 *   node test/run-integration.js real
 */

import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { findTestFiles } from './run-utils.js'
import { SCOPES } from '../lib/constants.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Set log level to SILENT for clean group output, but allow explicit overrides
if (!process.env.CEP_LOG_LEVEL) {
  process.env.CEP_LOG_LEVEL = 'SILENT'
}

/* Tool-wrapper pre-flight reads ~/.config/cep-mcp/tokens.json before every
   handler call. Redirect HOME so integration tests see a synthetic valid
   cache instead of the dev's real (possibly expired) one. */
const homeKey = process.platform === 'win32' ? 'APPDATA' : 'HOME'
const fakeHome = fs.mkdtempSync(join(os.tmpdir(), 'cep-mcp-integration-home-'))
const cacheDir = process.platform === 'win32' ? join(fakeHome, 'cep-mcp') : join(fakeHome, '.config', 'cep-mcp')
fs.mkdirSync(cacheDir, { recursive: true })
fs.writeFileSync(
  join(cacheDir, 'tokens.json'),
  JSON.stringify({
    access_token: 'synthetic-integration-test-token',
    token_type: 'Bearer',
    scope: Object.values(SCOPES).join(' '),
    expiry_date: Date.now() + 3_600_000,
  }),
  { mode: 0o600 },
)
process.env[homeKey] = fakeHome
process.on('exit', () => {
  fs.rmSync(fakeHome, { recursive: true, force: true })
})

const backend = process.argv[2] || 'fake'

if (backend !== 'fake' && backend !== 'real') {
  console.error(`Unknown backend: "${backend}". Expected "fake" or "real".`)
  process.exit(1)
}

process.env.CEP_BACKEND = backend

const integrationDirs = [join(root, 'test', 'integration', 'tools'), join(root, 'test', 'integration', 'server')]
const testFiles = integrationDirs.flatMap(dir => findTestFiles(dir)).sort()

if (testFiles.length === 0) {
  console.error('No test files found under test/integration/tools/ or test/integration/server/')
  process.exit(1)
}

console.log(`Running ${testFiles.length} integration test file(s) with CEP_BACKEND=${backend}...\n`)

try {
  execFileSync(process.execPath, ['--test', '--test-reporter', 'spec', ...testFiles], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
} catch {
  process.exit(1)
}
