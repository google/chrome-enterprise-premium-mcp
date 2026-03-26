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

import assert from 'node:assert/strict'

/**
 * Validates that the 'actual' object contains all key-value pairs from 'expected'.
 */
export function assertObjectMatches(actual, expected) {
  const subset = Object.fromEntries(Object.keys(expected).map(k => [k, actual[k]]))
  assert.deepStrictEqual(subset, expected)
}

/**
 * Robustly extracts a value following a specific label (e.g., "Customer ID: C123").
 *
 * @param {string} text - The text to search.
 * @param {string} label - The label to find.
 * @returns {string|null} The extracted value or null.
 */
export function extractValue(text, label) {
  // Use a regex that finds the label and captures the non-whitespace string following it.
  const regex = new RegExp(`${label}:\\s*([^\\n\\r\\s]+)`, 'i')
  const match = text.match(regex)
  return match ? match[1].trim() : null
}

/**
 * Robustly extracts text and parsed JSON details from a tool result.
 *
 * @param {object} result - The result object from client.callTool.
 * @returns {object} { text, details }
 */
export function parseToolOutput(result) {
  assert.ok(result?.content, 'Tool result missing content')
  const text = result.content[0].text

  let details = null
  // Non-greedy find for the outermost { ... } or [ ... ] block.
  // We look for a JSON block that follows the 'Details:' marker if it exists.
  const detailsMarker = 'Details:'
  const markerIndex = text.lastIndexOf(detailsMarker)
  const searchArea = markerIndex !== -1 ? text.substring(markerIndex + detailsMarker.length) : text

  const jsonMatch = searchArea.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)

  if (jsonMatch) {
    try {
      details = JSON.parse(jsonMatch[0])
    } catch (e) {
      // Not valid JSON
    }
  }

  return { text, details }
}
