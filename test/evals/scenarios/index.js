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
 * @fileoverview Eval scenario loader.
 *
 * Auto-discovers scenario files in this directory. Each file (except
 * base-state.js and index.js) exports a `mutate(state)` function that
 * receives a cloned base state and returns the modified version.
 *
 * The filename (without .js) becomes the scenario name, matching the
 * `scenario:` field in eval frontmatter.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBaseState } from './base-state.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKIP_FILES = new Set(['index.js', 'base-state.js'])

/** @type {Map<string, (state: object) => object>} */
const registry = new Map()

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && !SKIP_FILES.has(f))
for (const file of files) {
  const name = path.basename(file, '.js')
  const mod = await import(`./${file}`)
  registry.set(name, mod.mutate)
}

/**
 * Returns a clone of the base state with the named scenario mutation applied.
 *
 * @param {string} name - Scenario name (must match a file in scenarios/).
 * @returns {ReturnType<typeof getBaseState>} The mutated state.
 * @throws {Error} If the scenario name is not found.
 */
export function applyScenario(name) {
  const fn = registry.get(name)
  if (!fn) {
    const available = [...registry.keys()].sort().join(', ')
    throw new Error(`Unknown eval scenario "${name}". Available: ${available}`)
  }
  return fn(structuredClone(getBaseState()))
}

export { getBaseState }
