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

import { describe, test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OAUTH_SCOPE_CONFIG } from '../../lib/constants.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_DOC_PATH = path.resolve(__dirname, '../../docs/configuration.md')

describe('DWD Scopes Documentation Sync', () => {
  test('Verify that docs/configuration.md is synchronized with lib/constants.js OAUTH_SCOPE_CONFIG', async () => {
    // 1. Calculate expected DWD scopes from constants
    const EXCLUDED_CATEGORIES = ['Identity', 'Service Usage', 'Google Cloud Platform']
    const expectedScopes = Object.values(OAUTH_SCOPE_CONFIG)
      .filter(scope => !EXCLUDED_CATEGORIES.includes(scope.category))
      .map(scope => scope.url)
      .sort()

    // 2. Read docs/configuration.md
    let content
    try {
      content = await fs.readFile(CONFIG_DOC_PATH, 'utf8')
    } catch (err) {
      assert.fail(`Could not read documentation file at ${CONFIG_DOC_PATH}: ${err.message}`)
    }

    // 3. Extract the scopes block
    const START_MARKER = '<!-- START_DWD_SCOPES -->'
    const END_MARKER = '<!-- END_DWD_SCOPES -->'

    const startIndex = content.indexOf(START_MARKER)
    const endIndex = content.indexOf(END_MARKER)

    assert.ok(startIndex !== -1, 'Could not find <!-- START_DWD_SCOPES --> marker in docs/configuration.md')
    assert.ok(endIndex !== -1, 'Could not find <!-- END_DWD_SCOPES --> marker in docs/configuration.md')

    const scopesBlock = content.slice(startIndex + START_MARKER.length, endIndex).trim()

    // Extract urls from the markdown code block (removing the ``` lines and trimming commas/whitespace)
    const urlsInDoc = scopesBlock
      .replace(/```/g, '')
      .split('\n')
      .map(line => line.replace(/,/g, '').trim())
      .filter(line => line.length > 0)
      .sort()

    // 4. Assert equality
    assert.deepStrictEqual(
      urlsInDoc,
      expectedScopes,
      'The DWD scopes list in docs/configuration.md is out of sync with lib/constants.js. ' +
        'Please run "node tools/scripts/generate-dwd-scopes.js" to synchronize the documentation.',
    )
  })
})
