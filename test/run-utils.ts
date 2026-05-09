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

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Recursively finds all `.test.js` files under a given directory.
 * @param dir The root directory to search.
 * @returns Array of absolute paths to matching test files.
 */
export function findTestFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findTestFiles(full))
    } else if (entry.name.endsWith('.test.js') || entry.name.endsWith('.test.ts')) {
      results.push(full)
    }
  }
  return results
}
