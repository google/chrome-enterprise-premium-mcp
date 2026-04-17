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
 * @file Parses eval Markdown files with YAML frontmatter into
 * structured EvalCase objects. See test/evals/README.md for format spec.
 */

import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

/** Helpers */

/**
 * Extracts a named ## section from markdown body text.
 * Returns the content between the heading and the next ## heading (or EOF).
 * @param body
 * @param heading
 */
function extractSection(body, heading) {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$`, 'im')
  const match = body.match(pattern)
  if (!match) {
    return null
  }

  const start = match.index + match[0].length
  const rest = body.slice(start)
  const nextHeading = rest.search(/^##\s+/m)
  const content = nextHeading === -1 ? rest : rest.slice(0, nextHeading)
  return content.trim() || null
}

/** Public API */

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

/**
 * Loads one or more evals from a Markdown file.
 * Multiple evals are separated by '--- CASE ---' delimiters.
 * Each block starts with YAML metadata, followed by Markdown body starting at the first '## '.
 * @param {string} filepath - Absolute path to the .md file.
 * @param {{ forbiddenPatterns: string[], defaultJudgeRubric: string }} globalConfig
 * @returns {EvalCase[]}
 */
export function loadEvalsFromFile(filepath, globalConfig) {
  const raw = fs.readFileSync(filepath, 'utf8')

  // Split by case delimiter
  const cases = raw.split(/^--- CASE ---$/m)
  const evals = []

  for (let caseBlock of cases) {
    caseBlock = caseBlock.trim()
    if (!caseBlock) {
      continue
    }

    // Split metadata (YAML) from body (Markdown) at the first occurrence of '## '
    const firstHeadingIdx = caseBlock.indexOf('## ')
    if (firstHeadingIdx === -1) {
      console.warn(`[eval-loader] Skipping block in ${filepath}: No '## ' heading found.`)
      continue
    }

    const yamlPart = caseBlock.substring(0, firstHeadingIdx).trim().replace(/^---/, '').replace(/---$/, '')
    const body = caseBlock.substring(firstHeadingIdx)

    let frontmatter
    try {
      frontmatter = yaml.load(yamlPart) || {}
    } catch (err) {
      console.error(`[eval-loader] YAML error in ${filepath}:`, err.message)
      continue
    }

    if (!frontmatter.id) {
      console.warn(`[eval-loader] Skipping block in ${filepath}: Missing 'id' in metadata.`)
      continue
    }

    const perEvalForbidden = frontmatter.forbidden_patterns || []
    const mergedForbidden = frontmatter.forbidden_patterns_override
      ? perEvalForbidden
      : [...globalConfig.forbiddenPatterns, ...perEvalForbidden]

    evals.push({
      id: String(frontmatter.id),
      category: frontmatter.category || path.basename(path.dirname(filepath)),
      priority: (frontmatter.priority || 'P2').toUpperCase(),
      tags: frontmatter.tags || [],
      expectedTools: frontmatter.expected_tools || [],
      forbiddenPatterns: mergedForbidden,
      requiredPatterns: frontmatter.required_patterns || [],
      scenario: frontmatter.scenario || null,
      promptName: frontmatter.prompt_name || null,
      fixtures: frontmatter.fixtures || [],
      prompt: extractSection(body, 'Prompt') || '',
      goldenResponse: extractSection(body, 'Golden Response') || '',
      judgeInstructions: extractSection(body, 'Judge Instructions'),
      sourceFile: filepath,
    })
  }

  return evals
}

/**
 * Loads all evals from the cases/ subdirectories, with optional filtering.
 * @param {object} options
 * @param {string} options.dir - Path to test/evals directory.
 * @param {string} [options.category] - Comma-separated category filter.
 * @param {string[]} [options.tags] - Tag filter (eval must have at least one).
 * @param {string[]} [options.ids] - Specific eval IDs to load.
 * @param {string[]} [options.priority] - Specific priority levels to load (e.g., ['P0', 'P1']).
 * @returns {EvalCase[]}
 */
export function loadAllEvals({ dir, category, tags, ids, priority }) {
  const globalConfig = loadGlobalConfig(dir)
  const casesDir = path.join(dir, 'cases')

  // Walk cases/ directory for .md files (compatible with Node >= 18)
  const files = []
  const walk = d => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.md')) {
        files.push(full)
      }
    }
  }
  walk(casesDir)

  let evals = files.flatMap(f => loadEvalsFromFile(f, globalConfig))

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
 * @property {string} sourceFile
 */
