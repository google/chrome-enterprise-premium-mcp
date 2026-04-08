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
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadGlobalConfig, loadEval, loadAllEvals } from '../evals/lib/loader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const evalsDir = path.resolve(__dirname, '..', 'evals')

describe('Eval Loader', () => {
  describe('loadGlobalConfig', () => {
    it('should load forbidden patterns from global.yaml', () => {
      const config = loadGlobalConfig(evalsDir)
      assert.ok(Array.isArray(config.forbiddenPatterns))
      assert.ok(config.forbiddenPatterns.length > 0, 'should have forbidden patterns')
      assert.ok(config.forbiddenPatterns.includes('search_content'), 'should include tool names')
    })

    it('should load default judge rubric', () => {
      const config = loadGlobalConfig(evalsDir)
      assert.ok(typeof config.defaultJudgeRubric === 'string')
      assert.ok(config.defaultJudgeRubric.length > 0)
    })
  })

  describe('loadEval', () => {
    it('should parse a markdown eval file with YAML frontmatter', () => {
      const config = loadGlobalConfig(evalsDir)
      const evalFile = path.join(evalsDir, 'cases', 'knowledge', 'k01-what-is-chrome-enterprise-premium-and-wh.md')
      const evalCase = loadEval(evalFile, config)

      assert.strictEqual(evalCase.id, 'k01')
      assert.strictEqual(evalCase.category, 'knowledge')
      assert.deepStrictEqual(evalCase.tags, ['overview'])
      assert.deepStrictEqual(evalCase.expectedTools, ['search_content'])
      assert.ok(evalCase.prompt.includes('Chrome Enterprise Premium'))
      assert.ok(evalCase.goldenResponse.includes('Chrome Enterprise Premium'))
    })

    it('should merge global forbidden patterns with per-eval patterns', () => {
      const config = loadGlobalConfig(evalsDir)
      const evalFile = path.join(evalsDir, 'cases', 'knowledge', 'k01-what-is-chrome-enterprise-premium-and-wh.md')
      const evalCase = loadEval(evalFile, config)

      // Should include global patterns (tool names etc.)
      assert.ok(evalCase.forbiddenPatterns.includes('search_content'))
    })

    it('should extract required_patterns from frontmatter', () => {
      const config = loadGlobalConfig(evalsDir)
      const evalFile = path.join(evalsDir, 'cases', 'knowledge', 'k03-how-much-does-chrome-enterprise-premium.md')
      const evalCase = loadEval(evalFile, config)

      assert.ok(evalCase.requiredPatterns.includes('$6'))
    })
  })

  describe('loadAllEvals', () => {
    it('should load all eval files', () => {
      const evals = loadAllEvals({ dir: evalsDir })
      assert.ok(evals.length > 0, 'should find eval cases')
      // Each eval should have required fields
      for (const e of evals) {
        assert.ok(e.id, `eval missing id`)
        assert.ok(e.category, `eval ${e.id} missing category`)
        assert.ok(e.prompt, `eval ${e.id} missing prompt`)
      }
    })

    it('should filter by category', () => {
      const evals = loadAllEvals({ dir: evalsDir, category: 'knowledge' })
      assert.ok(evals.length > 0)
      for (const e of evals) {
        assert.strictEqual(e.category, 'knowledge')
      }
    })

    it('should filter by multiple categories', () => {
      const evals = loadAllEvals({ dir: evalsDir, category: 'inspection,mutation' })
      assert.ok(evals.length > 0)
      for (const e of evals) {
        assert.ok(['inspection', 'mutation'].includes(e.category))
      }
    })

    it('should filter by tags', () => {
      const evals = loadAllEvals({ dir: evalsDir, tags: ['overview'] })
      assert.ok(evals.length > 0)
      for (const e of evals) {
        assert.ok(e.tags.some(t => t.toLowerCase() === 'overview'))
      }
    })

    it('should filter by id', () => {
      const evals = loadAllEvals({ dir: evalsDir, ids: ['k01'] })
      assert.strictEqual(evals.length, 1)
      assert.strictEqual(evals[0].id, 'k01')
    })

    it('should sort by ID with numeric ordering', () => {
      const evals = loadAllEvals({ dir: evalsDir, category: 'knowledge' })
      for (let i = 1; i < evals.length; i++) {
        const cmp = evals[i - 1].id.localeCompare(evals[i].id, undefined, { numeric: true })
        assert.ok(cmp <= 0, `${evals[i - 1].id} should come before ${evals[i].id}`)
      }
    })
  })
})
