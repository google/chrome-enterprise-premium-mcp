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
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const knowledgeDir = path.resolve(__dirname, '../../lib/knowledge')

describe('Knowledge Folder Structure', () => {
  it('When knowledge files are listed, then all files should have a number prefix', async () => {
    const files = await fs.readdir(knowledgeDir)

    // Ignore hidden files like .gitkeep or .DS_Store
    // We expect files to start with a number and a hyphen, e.g., "15-..." or "4-..."
    const pattern = /^\d+-/

    for (const file of files) {
      if (file.startsWith('.') || file === 'README.md' || file === 'instructions.js') {
        continue
      }

      assert.ok(pattern.test(file), `File '${file}' in lib/knowledge/ does not have a number prefix.`)
    }
  })
})
