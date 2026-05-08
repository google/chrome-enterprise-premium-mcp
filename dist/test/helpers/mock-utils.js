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
import { fileURLToPath, pathToFileURL } from 'node:url'
/**
 * Robustly extracts the caller's file path from a stack trace.
 * @returns {string} The absolute path of the calling module.
 */
function getCallerPath() {
  const stack = new Error().stack.split('\n')
  const thisFile = fileURLToPath(import.meta.url)
  for (let i = 2; i < stack.length; i++) {
    const line = stack[i]
    const match =
      line.match(/file:\/\/\/([^:]+)/) || line.match(/\(([^:]+):\d+:\d+\)/) || line.match(/at\s+([^:]+):\d+:\d+/)
    if (match) {
      const p = match[1].startsWith('/') ? match[1] : '/' + match[1]
      if (p !== thisFile && !p.includes('node:internal')) {
        return p
      }
    }
  }
  throw new Error('Could not determine caller path from stack trace')
}
/**
 * TODO: Remove this entire wrapper and revert to raw 'esmock' once the migration
 * is complete (Phase 4) and all test import paths point directly to .ts files.
 *
 * Enhanced esmock wrapper that handles .js -> .ts resolution automatically.
 */
export async function esmock(moduleId, mocks = {}, globals = {}) {
  const callerPath = getCallerPath()
  const callerUrl = pathToFileURL(callerPath).href
  const resolve = async id => {
    if (typeof id !== 'string' || (!id.startsWith('.') && !id.startsWith('/'))) {
      return id
    }
    try {
      const resolvedUrl = await import.meta.resolve(id, callerUrl)
      return fileURLToPath(resolvedUrl)
    } catch {
      return id
    }
  }
  const resolvedId = await resolve(moduleId)
  const resolvedMocks = {}
  for (const [key, value] of Object.entries(mocks)) {
    resolvedMocks[await resolve(key)] = value
  }
  return esmockReal(resolvedId, resolvedMocks, globals)
}
