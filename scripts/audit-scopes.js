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
 * @file Audit script: cross-reference scopes against Google's live discovery docs.
 *
 * For each SCOPES entry in lib/constants.js, this script:
 * 1. Locates call sites in lib/api/ that request the scope.
 * 2. Fetches the corresponding Google API discovery doc.
 * 3. Verifies that the method called accepts the scope(s) being requested.
 * 4. Reports unused scopes and any mismatches.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

/**
 * Fetch a discovery doc from Google's API; return parsed JSON.
 * @param {string} url - The discovery doc URL to fetch
 * @returns {Promise<?object>} Parsed JSON doc, or null if fetch fails
 */
async function fetchDiscoveryDoc(url) {
  try {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.json()
  } catch (err) {
    // Print the URL + error so a flaky network does not silently produce a
    // false "0 mismatches" result. The caller treats null as "skipped".
    console.error(`[audit-scopes] discovery fetch failed for ${url}: ${err.message}`)
    return null
  }
}

/**
 * Walk the discovery doc's resource tree and collect (method-path, scopes[]) pairs.
 * @param {object} resources - Discovery doc resources object
 * @param {string} [parentPath] - Parent resource path
 * @returns {Array<object>} Array of {methodPath, scopes}
 */
function extractMethodScopes(resources, parentPath = '') {
  const results = []

  for (const [resName, resource] of Object.entries(resources)) {
    const newPath = parentPath ? `${parentPath}.${resName}` : resName

    if (resource.methods) {
      for (const [methodName, methodDef] of Object.entries(resource.methods)) {
        const fullPath = `${newPath}.${methodName}`
        const scopes = methodDef.scopes || []
        results.push({
          methodPath: fullPath,
          scopes: scopes,
        })
      }
    }

    if (resource.resources) {
      results.push(...extractMethodScopes(resource.resources, newPath))
    }
  }

  return results
}

/**
 * Normalize a scope URL to a short form for comparison.
 * E.g. "https://www.googleapis.com/auth/admin.reports.audit.readonly" -> "admin.reports.audit.readonly"
 * @param {string} url - The scope URL to normalize
 * @returns {string} Normalized scope string
 */
function normalizeScopeUrl(url) {
  return url.replace(/^https:\/\/www\.googleapis\.com\/auth\//, '')
}

/**
 * Check if a requested scope matches any accepted scope for a method.
 * Handles wildcards and partial matches in discovery docs.
 * @param {string} requestedScope - The requested scope URL
 * @param {Array<string>} acceptedScopes - Array of accepted scope URLs
 * @returns {boolean} True if requested scope matches any accepted scope
 */
function scopeMatches(requestedScope, acceptedScopes) {
  const normalized = normalizeScopeUrl(requestedScope)

  for (const accepted of acceptedScopes) {
    const normAccepted = normalizeScopeUrl(accepted)

    // Exact match
    if (normalized === normAccepted) {
      return true
    }

    // Check for wildcard or prefix match
    if (normAccepted.endsWith('*')) {
      const prefix = normAccepted.slice(0, -1)
      if (normalized.startsWith(prefix)) {
        return true
      }
    }

    // Handle variations like "cloud-platform" vs "cloud-platform.read-only"
    if (
      (normalized === 'cloud-platform' || normalized.startsWith('cloud-platform.')) &&
      (normAccepted === 'cloud-platform' || normAccepted.startsWith('cloud-platform.'))
    ) {
      return true
    }
  }

  return false
}

/**
 * Parse lib/api/*.js files and extract [SCOPES.X, ...] patterns.
 * Also infer the API being used from context (method names, service objects).
 * @returns {Promise<Array<object>>} Array of {file, line, scopes, inferredApi}
 */
async function extractCallSites() {
  const apiDir = path.join(PROJECT_ROOT, 'lib', 'api')
  const files = await fs.readdir(apiDir)
  const callSites = [] // { file, line, scopes: [names], inferredApi: string }

  for (const file of files) {
    if (!file.endsWith('.js')) {
      continue
    }

    const filePath = path.join(apiDir, file)
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Match patterns like [SCOPES.X] or [SCOPES.X, SCOPES.Y, ...]
      const match = line.match(/\[\s*SCOPES\.([A-Z_]+)(?:\s*,\s*SCOPES\.([A-Z_]+))*\s*\]/g)
      if (match) {
        for (const m of match) {
          const names = m.match(/SCOPES\.([A-Z_]+)/g).map(x => x.replace('SCOPES.', ''))

          // Infer API from the line context or the enclosing function/method.
          let inferredApi = null
          if (line.includes('getLicensingService')) {
            inferredApi = 'licensing'
          } else if (line.includes('getAdminService')) {
            inferredApi = 'admin'
          } else if (line.includes('chromemanagement')) {
            inferredApi = 'chromemanagement'
          } else if (line.includes('chromepolicy')) {
            inferredApi = 'chromepolicy'
          } else if (line.includes('cloudidentity')) {
            inferredApi = 'cloudidentity'
          } else if (line.includes('serviceusage')) {
            inferredApi = 'serviceusage'
          }

          // Fallback: infer from filename.
          if (!inferredApi) {
            if (file.includes('admin')) {
              inferredApi = 'admin'
            } else if (file.includes('chromemanagement')) {
              inferredApi = 'chromemanagement'
            } else if (file.includes('chromepolicy')) {
              inferredApi = 'chromepolicy'
            } else if (file.includes('cloudidentity')) {
              inferredApi = 'cloudidentity'
            } else if (file.includes('service_usage')) {
              inferredApi = 'serviceusage'
            }
          }

          callSites.push({
            file: `lib/api/${file}`,
            line: i + 1,
            scopes: names,
            inferredApi,
          })
        }
      }
    }
  }

  return callSites
}

/**
 * Main audit flow.
 */
async function main() {
  // 1. Load SCOPES from constants.
  const constants = await import(path.join(PROJECT_ROOT, 'lib/constants.js'))
  const SCOPES = constants.SCOPES

  console.log('== SCOPES from lib/constants.js ==')
  for (const [key, value] of Object.entries(SCOPES)) {
    console.log(`${key.padEnd(35)} ${value}`)
  }

  // 2. Extract call sites.
  const callSites = await extractCallSites()
  console.log('\n== Per-call-site scope requests ==')
  const requestedScopeNames = new Set()
  for (const site of callSites) {
    const scopeStr = site.scopes.join(', ')
    console.log(`${site.file}:${site.line}`.padEnd(40) + ` [${scopeStr}]`)
    site.scopes.forEach(s => requestedScopeNames.add(s))
  }

  // 3. Find unused scopes.
  console.log('\n== Unused SCOPES (no call site requests them) ==')
  let hasUnused = false
  for (const [key] of Object.entries(SCOPES)) {
    if (!requestedScopeNames.has(key)) {
      console.log(`${key} — no call site requests it`)
      hasUnused = true
    }
  }
  if (!hasUnused) {
    console.log('(none)')
  }

  // 4. Fetch discovery docs and cross-check.
  console.log('\n== Discovery cross-check ==')

  const discoveryDocs = [
    {
      api: 'admin',
      urls: [
        'https://www.googleapis.com/discovery/v1/apis/admin/directory_v1/rest',
        'https://www.googleapis.com/discovery/v1/apis/admin/reports_v1/rest',
      ],
    },
    {
      api: 'chromemanagement',
      urls: ['https://www.googleapis.com/discovery/v1/apis/chromemanagement/v1/rest'],
    },
    {
      api: 'chromepolicy',
      urls: ['https://www.googleapis.com/discovery/v1/apis/chromepolicy/v1/rest'],
    },
    {
      api: 'cloudidentity',
      urls: ['https://www.googleapis.com/discovery/v1/apis/cloudidentity/v1beta1/rest'],
    },
    {
      api: 'licensing',
      urls: ['https://www.googleapis.com/discovery/v1/apis/licensing/v1/rest'],
    },
    {
      api: 'serviceusage',
      urls: ['https://www.googleapis.com/discovery/v1/apis/serviceusage/v1/rest'],
    },
  ]

  const methodScopesByApi = {}
  for (const { api, urls } of discoveryDocs) {
    methodScopesByApi[api] = []
    for (const url of urls) {
      const doc = await fetchDiscoveryDoc(url)
      if (!doc || !doc.resources) {
        continue
      }
      const methods = extractMethodScopes(doc.resources)
      methodScopesByApi[api].push(...methods)
    }
  }

  // Cross-check: verify that requested scopes exist in the API's discovery docs.
  let mismatchCount = 0
  const allAcceptedScopesByApi = {}

  // Collect all accepted scopes per API.
  for (const [api, methods] of Object.entries(methodScopesByApi)) {
    allAcceptedScopesByApi[api] = new Set()
    for (const method of methods) {
      for (const scope of method.scopes) {
        allAcceptedScopesByApi[api].add(scope)
      }
    }
  }

  for (const site of callSites) {
    const api = site.inferredApi

    // Skip if API docs aren't available or API is unknown.
    if (!api || !allAcceptedScopesByApi[api] || allAcceptedScopesByApi[api].size === 0) {
      continue
    }

    // Verify each requested scope is accepted somewhere in the API.
    for (const scopeName of site.scopes) {
      const scopeUrl = SCOPES[scopeName]
      if (!scopeUrl) {
        console.log(`✗ scope ${scopeName} not found in SCOPES`)
        mismatchCount++
        continue
      }

      let found = false
      for (const accepted of allAcceptedScopesByApi[api]) {
        if (scopeMatches(scopeUrl, [accepted])) {
          found = true
          break
        }
      }

      if (!found) {
        console.log(`✗ ${site.file}:${site.line} requests ${scopeName}, not accepted by ${api}`)
        mismatchCount++
      }
    }
  }

  // Print summary of methods and their accepted scopes (sample).
  console.log('\n== Sample method scopes from discovery docs ==')
  let sampleCount = 0
  for (const [api, methods] of Object.entries(methodScopesByApi)) {
    if (methods.length === 0) {
      continue
    }
    for (const method of methods.slice(0, 3)) {
      const scopeStrs = method.scopes.map(s => normalizeScopeUrl(s)).join(', ')
      console.log(`${api} ${method.methodPath}`.padEnd(45) + ` → ${scopeStrs || '(none)'}`)
      sampleCount++
      if (sampleCount >= 8) {
        break
      }
    }
    if (sampleCount >= 8) {
      break
    }
  }
  if (sampleCount === 0) {
    console.log('(no discovery docs available, scope verification skipped)')
  }

  // Final summary.
  console.log('\n== Summary ==')
  console.log(`${requestedScopeNames.size} scopes requested by call sites.`)
  const unusedCount = Object.keys(SCOPES).length - requestedScopeNames.size
  if (unusedCount > 0) {
    console.log(`${unusedCount} scope(s) defined but not requested.`)
  }
  if (mismatchCount > 0) {
    console.log(`${mismatchCount} mismatch(es) detected.`)
  } else {
    console.log('0 mismatches detected.')
  }
}

main().catch(error => {
  console.error('Error:', error.message)
  throw error
})
