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
 * @file Syncs the package version from package.json to gemini-extension.json.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Syncs the version range in gemini-extension.json args with the package.json version.
 * @returns {void}
 */
function syncVersion() {
  const packageJsonPath = path.resolve(__dirname, '../package.json')
  const extensionJsonPath = path.resolve(__dirname, '../gemini-extension.json')

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const extensionJson = JSON.parse(fs.readFileSync(extensionJsonPath, 'utf8'))

  const currentVersion = packageJson.version
  const args = extensionJson.mcpServers['chrome-enterprise-premium'].args

  if (!Array.isArray(args)) {
    throw new Error('mcpServers.chrome-enterprise-premium.args must be an array')
  }

  const packageArgIndex = args.findIndex(arg => arg.startsWith('@google/chrome-enterprise-premium-mcp@'))
  if (packageArgIndex === -1) {
    throw new Error('Could not find @google/chrome-enterprise-premium-mcp dependency in args')
  }

  const expectedArg = `@google/chrome-enterprise-premium-mcp@^${currentVersion}`
  if (args[packageArgIndex] !== expectedArg) {
    args[packageArgIndex] = expectedArg
    fs.writeFileSync(extensionJsonPath, JSON.stringify(extensionJson, null, 2) + '\n', 'utf8')
    console.log(`Successfully updated gemini-extension.json args version to ^${currentVersion}`)
  } else {
    console.log('gemini-extension.json version is already in sync.')
  }
}

syncVersion()
