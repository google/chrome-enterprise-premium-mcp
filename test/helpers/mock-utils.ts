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

import esmockReal from 'esmock'

/**
 * TODO: Remove this entire wrapper and revert to raw 'esmock' once the migration
 * is complete (Phase 4) and all test import paths point directly to .ts files.
 *
 * Enhanced esmock wrapper that handles .js -> .ts resolution automatically.
 * This ensures tests remain green regardless of the codebase migration state
 * by leveraging import.meta.resolve to find the actual implementation file.
 *
 * @param {string} moduleId - Path to the module to mock.
 * @param {object} mocks - Map of dependency mocks.
 * @param {object} [globals] - Global mocks.
 * @returns {Promise<any>} The mocked module.
 */
export async function esmock(moduleId, mocks = {}, globals = {}) {
  const resolvedId = await import.meta.resolve(moduleId)

  const resolvedMocks = {}
  for (const [key, value] of Object.entries(mocks)) {
    // Only resolve relative/absolute paths, skip package names
    const resolvedKey = key.startsWith('.') || key.startsWith('/') ? await import.meta.resolve(key) : key
    resolvedMocks[resolvedKey] = value
  }

  return esmockReal(resolvedId, resolvedMocks, globals)
}
