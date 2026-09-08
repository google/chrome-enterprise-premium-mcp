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
 * @file Synchronizes the DWD scopes list in docs/configuration.md with lib/constants.js.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OAUTH_SCOPE_CONFIG } from '../../lib/constants.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_DOC_PATH = path.resolve(__dirname, '../../docs/configuration.md')

// Filter out non-DWD scope categories
const EXCLUDED_CATEGORIES = ['Identity', 'Service Usage', 'Google Cloud Platform']

const dwdScopes = Object.values(OAUTH_SCOPE_CONFIG)
  .filter(scope => !EXCLUDED_CATEGORIES.includes(scope.category))
  .map(scope => scope.url)
  .sort()

const scopesBlock = '   ```\n   ' + dwdScopes.join(',\n   ') + '\n   ```'

const START_MARKER = '<!-- START_DWD_SCOPES -->'
const END_MARKER = '<!-- END_DWD_SCOPES -->'

const content = await fs.readFile(CONFIG_DOC_PATH, 'utf8')
const startIndex = content.indexOf(START_MARKER)
const endIndex = content.indexOf(END_MARKER)

if (startIndex === -1 || endIndex === -1) {
  throw new Error('DWD scopes markers not found in docs/configuration.md')
}

const before = content.slice(0, startIndex + START_MARKER.length)
const after = content.slice(endIndex)

const updatedContent = `${before}\n${scopesBlock}\n   ${after}`

await fs.writeFile(CONFIG_DOC_PATH, updatedContent, 'utf8')
console.log('Successfully synchronized DWD scopes in docs/configuration.md!')
