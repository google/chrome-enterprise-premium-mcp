import { it, describe } from 'node:test'
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
