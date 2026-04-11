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
 * @file Runs the full test suite: unit tests + smoke tests.
 *
 * Usage: node test/run-all.js
 *
 * Evals are not included — run them separately via `npm run eval`.
 */

/* eslint-disable n/no-process-exit */

import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const suites = [
  { name: 'UNIT TESTS', cmd: 'node test/run-unit.js' },
  { name: 'SMOKE TESTS', cmd: 'node test/local/smoke-test.js', env: { GCP_STDIO: 'false' } },
]

const results = []

for (const suite of suites) {
  console.log('----------------------------------------')
  console.log(`--- ${suite.name} ---\n`)
  try {
    execSync(suite.cmd, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...suite.env },
    })
    results.push({ name: suite.name, passed: true })
  } catch {
    results.push({ name: suite.name, passed: false })
  }
  console.log()
}

console.log('----------------------------------------')

const failed = results.filter(r => !r.passed)
if (failed.length === 0) {
  console.log('✅ ALL TESTS: PASSED')
  console.log('\nNote: Evals are not part of the standard test suite.')
  console.log('Run evals separately: npm run eval')
  process.exit(0)
} else {
  console.log('❌ ALL TESTS: FAILED')
  for (const f of failed) {
    console.log(`   - ${f.name} failed`)
  }
  process.exit(1)
}
