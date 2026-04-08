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
 * @fileoverview Deterministic eval assertions -- no LLM involved.
 *
 * These checks run before the LLM judge and produce hard pass/fail results.
 * A forbidden pattern match = immediate FAIL regardless of judge verdict.
 */

/**
 * Checks that no forbidden patterns appear in the response text.
 * Patterns prefixed with "re:" are treated as regex; others as case-insensitive substrings.
 *
 * @param {string} text - Agent response text.
 * @param {string[]} patterns - Forbidden patterns.
 * @returns {{ passed: boolean, failures: string[] }}
 */
export function checkForbidden(text, patterns) {
  const failures = []
  const lower = text.toLowerCase()

  for (const p of patterns) {
    if (p.startsWith('re:')) {
      const pattern = p.slice(3)
      // Basic ReDoS protection: skip extremely long or complex-looking patterns in evals
      if (pattern.length > 500) {
        failures.push(`forbidden regex "${p}" is too long/complex (potential ReDoS risk)`)
        continue
      }
      try {
        const regex = new RegExp(pattern, 'i')
        if (regex.test(text)) {
          failures.push(`forbidden pattern matched: ${p}`)
        }
      } catch (e) {
        failures.push(`invalid forbidden regex "${p}": ${e.message}`)
      }
    } else {
      if (lower.includes(p.toLowerCase())) {
        failures.push(`forbidden string found: "${p}"`)
      }
    }
  }

  return { passed: failures.length === 0, failures }
}

/**
 * Checks that all required patterns appear in the response text.
 *
 * @param {string} text - Agent response text.
 * @param {string[]} patterns - Required patterns.
 * @returns {{ passed: boolean, failures: string[] }}
 */
export function checkRequired(text, patterns) {
  const failures = []
  const lower = text.toLowerCase()

  for (const p of patterns) {
    if (p.startsWith('re:')) {
      const pattern = p.slice(3)
      if (pattern.length > 500) {
        failures.push(`required regex "${p}" is too long/complex (potential ReDoS risk)`)
        continue
      }
      try {
        const regex = new RegExp(pattern, 'i')
        if (!regex.test(text)) {
          failures.push(`required pattern not found: ${p}`)
        }
      } catch (e) {
        failures.push(`invalid required regex "${p}": ${e.message}`)
      }
    } else {
      if (!lower.includes(p.toLowerCase())) {
        failures.push(`required string missing: "${p}"`)
      }
    }
  }

  return { passed: failures.length === 0, failures }
}

/**
 * Checks that every expected tool was called by the agent.
 *
 * @param {string[]} actualToolNames - Tool names actually called.
 * @param {string[]} expectedToolNames - Tool names that should have been called.
 * @returns {{ passed: boolean, failures: string[] }}
 */
export function checkTools(actualToolNames, expectedToolNames) {
  const failures = []
  const actualSet = new Set(actualToolNames)

  for (const expected of expectedToolNames) {
    if (!actualSet.has(expected)) {
      failures.push(`expected tool not called: "${expected}"`)
    }
  }

  return { passed: failures.length === 0, failures }
}

/**
 * Runs all deterministic checks for an eval case.
 *
 * @param {string} responseText - Agent response text.
 * @param {string[]} actualTools - Tool names actually called.
 * @param {import('./loader.js').EvalCase} evalCase - The eval case.
 * @returns {{ passed: boolean, failures: string[] }}
 */
export function runChecks(responseText, actualTools, evalCase) {
  const forbidden = checkForbidden(responseText, evalCase.forbiddenPatterns)
  const required = checkRequired(responseText, evalCase.requiredPatterns)
  const tools = checkTools(actualTools, evalCase.expectedTools)

  const failures = [...forbidden.failures, ...required.failures, ...tools.failures]
  return { passed: failures.length === 0, failures }
}
