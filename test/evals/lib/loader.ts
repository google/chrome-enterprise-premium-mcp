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
 * @file Loads eval cases from `.eval.js` files into structured EvalCase
 * objects. Each case file lives at `test/evals/cases/<category>/<id>-<slug>.eval.js`
 * and default-exports its case object. See docs/evals/format.md for the spec.
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import yaml from 'js-yaml'

/**
 * Loads the global eval config from global.yaml.
 * @param {string} evalsDir - Path to the test/evals directory.
 * @returns {{ forbiddenPatterns: string[], defaultJudgeRubric: string }}
 */
export function loadGlobalConfig(evalsDir) {
  const configPath = path.join(evalsDir, 'global.yaml')
  const raw = fs.readFileSync(configPath, 'utf8')
  const config = yaml.load(raw)
  return {
    forbiddenPatterns: config.forbidden_patterns || [],
    defaultJudgeRubric: config.default_judge_rubric || '',
  }
}

const ID_PATTERN = /^[A-Za-z0-9_]+$/

const ALLOWED_FIELDS = new Set([
  'id',
  'priority',
  'tags',
  'scenario',
  'fixtures',
  'promptName',
  'expectedTools',
  'forbiddenPatterns',
  'forbiddenPatternsOverride',
  'requiredPatterns',
  'experiments',
  'prompt',
  'goldenResponse',
  'judgeInstructions',
])

/**
 * Loads a single eval case from a `.eval.js` file. The file must default-export
 * a case object whose shape matches the EvalCase typedef. Category is derived
 * from the parent directory name.
 * @param {string} filepath - Absolute path to the .eval.js file.
 * @param {{ forbiddenPatterns: string[], defaultJudgeRubric: string }} globalConfig
 * @returns {Promise<EvalCase>}
 */
export async function loadEvalAsCodeFromFile(filepath, globalConfig) {
  const url = pathToFileURL(filepath).href
  const mod = await import(url)
  const c = mod.default
  if (!c || typeof c !== 'object') {
    throw new Error(`[eval-loader] ${filepath}: default export must be a case object`)
  }

  for (const k of Object.keys(c)) {
    if (!ALLOWED_FIELDS.has(k)) {
      throw new Error(`[eval-loader] ${filepath}: unknown field '${k}'`)
    }
  }
  if (!c.id || typeof c.id !== 'string') {
    throw new Error(`[eval-loader] ${filepath}: missing required string field 'id'`)
  }
  if (!ID_PATTERN.test(c.id)) {
    throw new Error(`[eval-loader] ${filepath}: id '${c.id}' must match ${ID_PATTERN}`)
  }
  const hasInlinePrompt = typeof c.prompt === 'string' && c.prompt.length > 0
  if (!hasInlinePrompt && !c.promptName) {
    throw new Error(`[eval-loader] ${filepath}: must define either 'prompt' or 'promptName'`)
  }
  if (typeof c.goldenResponse !== 'string' || c.goldenResponse.length === 0) {
    throw new Error(`[eval-loader] ${filepath}: missing required string field 'goldenResponse'`)
  }
  if (c.scenario && Array.isArray(c.fixtures) && c.fixtures.length > 0) {
    throw new Error(
      `[eval-loader] ${filepath}: case '${c.id}' sets both \`fixtures\` and \`scenario\` — these are mutually exclusive (scenario replaces state, fixtures merge into state). Pick one.`,
    )
  }

  const perEvalForbidden = c.forbiddenPatterns || []
  const mergedForbidden = c.forbiddenPatternsOverride
    ? perEvalForbidden
    : [...globalConfig.forbiddenPatterns, ...perEvalForbidden]

  return {
    id: c.id,
    category: path.basename(path.dirname(filepath)),
    priority: (c.priority || 'P2').toUpperCase(),
    tags: c.tags || [],
    expectedTools: c.expectedTools || [],
    forbiddenPatterns: mergedForbidden,
    requiredPatterns: c.requiredPatterns || [],
    scenario: c.scenario || null,
    promptName: c.promptName || null,
    fixtures: c.fixtures || [],
    experiments: c.experiments || null,
    prompt: c.prompt || '',
    goldenResponse: c.goldenResponse,
    judgeInstructions: c.judgeInstructions || null,
    sourceFile: filepath,
  }
}

/**
 * Loads all evals from the cases/ subdirectories, with optional filtering.
 * @param {object} options
 * @param {string} options.dir - Path to test/evals directory.
 * @param {string} [options.category] - Comma-separated category filter.
 * @param {string[]} [options.tags] - Tag filter (eval must have at least one).
 * @param {string[]} [options.ids] - Specific eval IDs to load.
 * @param {string[]} [options.priority] - Specific priority levels to load (e.g., ['P0', 'P1']).
 * @returns {Promise<EvalCase[]>}
 */
export async function loadAllEvals({ dir, category, tags, ids, priority }) {
  const globalConfig = loadGlobalConfig(dir)
  const casesDir = path.join(dir, 'cases')

  const jsFiles = []
  const walk = d => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.eval.js')) {
        jsFiles.push(full)
      }
    }
  }
  walk(casesDir)

  let evals = await Promise.all(jsFiles.map(f => loadEvalAsCodeFromFile(f, globalConfig)))

  const seen = new Map()
  for (const e of evals) {
    if (seen.has(e.id)) {
      throw new Error(`[eval-loader] duplicate case id '${e.id}': defined in ${seen.get(e.id)} and ${e.sourceFile}`)
    }
    seen.set(e.id, e.sourceFile)
  }

  // Filter by priority
  if (priority && priority.length > 0) {
    const prioritySet = new Set(priority.map(p => p.trim().toUpperCase()))
    evals = evals.filter(e => prioritySet.has(e.priority))
  }

  // Filter by category
  if (category) {
    const cats = category.split(',').map(c => c.trim().toLowerCase())
    evals = evals.filter(e => cats.includes(e.category.toLowerCase()))
  }

  // Filter by tags (eval must match at least one)
  if (tags && tags.length > 0) {
    const tagSet = new Set(tags.map(t => t.trim().toLowerCase()))
    evals = evals.filter(e => e.tags.some(t => tagSet.has(t.toLowerCase())))
  }

  // Filter by IDs
  if (ids && ids.length > 0) {
    const idSet = new Set(ids.map(id => id.trim()))
    evals = evals.filter(e => idSet.has(e.id))
  }

  // Sort by ID for consistent ordering
  evals.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

  return evals
}

/**
 * @typedef {object} EvalCase
 * @property {string} id
 * @property {string} category
 * @property {string} priority
 * @property {string[]} tags
 * @property {string[]} expectedTools
 * @property {string[]} forbiddenPatterns
 * @property {string[]} requiredPatterns
 * @property {string|null} scenario - Scenario name from test/evals/scenarios/.
 * @property {string|null} promptName - MCP prompt name to fetch at runtime.
 * @property {string} prompt
 * @property {string} goldenResponse
 * @property {string|null} judgeInstructions
 * @property {string[]} fixtures
 * @property {object|null} experiments
 * @property {string} sourceFile
 */
