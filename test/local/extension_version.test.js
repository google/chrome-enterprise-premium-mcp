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

import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('gemini-extension.json package version matches package.json version', () => {
  const packageJsonPath = path.resolve(__dirname, '../../package.json')
  const extensionJsonPath = path.resolve(__dirname, '../../gemini-extension.json')

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const extensionJson = JSON.parse(fs.readFileSync(extensionJsonPath, 'utf8'))

  const currentVersion = packageJson.version
  assert.strictEqual(
    extensionJson.version,
    currentVersion,
    `gemini-extension.json version (${extensionJson.version}) must exactly match package.json version (${currentVersion})`,
  )

  const args = extensionJson.mcpServers['chrome-enterprise-premium'].args
  assert.ok(Array.isArray(args), 'args must be an array')

  const packageArg = args.find(arg => arg.startsWith('@google/chrome-enterprise-premium-mcp@'))
  assert.ok(packageArg, 'Could not find @google/chrome-enterprise-premium-mcp dependency in args')

  const lastAtIndex = packageArg.lastIndexOf('@')
  assert.ok(lastAtIndex > 0, 'Could not find version delimiter in argument')
  const rangeString = packageArg.slice(lastAtIndex + 1)
  assert.ok(rangeString, 'Could not extract version range from argument')

  assert.ok(rangeString.startsWith('^'), 'Version range must start with ^ for semantic versioning')
  const rangeVersion = rangeString.slice(1)
  const [rMajor, rMinor, rPatch] = rangeVersion.split('.').map(Number)
  const [cMajor, cMinor, cPatch] = currentVersion.split('.').map(Number)

  assert.strictEqual(cMajor, rMajor, `Major version mismatch: current ${cMajor} must match range ${rMajor}`)

  if (cMinor === rMinor) {
    assert.ok(cPatch >= rPatch, `Patch version is older than range: current ${cPatch} must be >= ${rPatch}`)
  } else {
    assert.ok(cMinor > rMinor, `Minor version is older than range: current ${cMinor} must be > ${rMinor}`)
  }
})
