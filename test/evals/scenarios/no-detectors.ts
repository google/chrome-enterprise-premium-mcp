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
 * @fileoverview Scenario: no custom content detectors configured.
 *
 * DLP rules exist but all custom detectors (regex, word list, URL list)
 * have been removed. Rules referencing custom detectors will not match.
 *
 * Used by: pr17 (prompt diagnose).
 */

/** @param {object} state - Cloned base state. */
export function mutate(state) {
  const detectorTypes = new Set([
    'settings/detector',
    'settings/detector.regex',
    'settings/detector.word_list',
    'settings/detector.url_list',
  ])
  for (const [name, policy] of Object.entries(state.policies)) {
    if (detectorTypes.has(policy.setting?.type)) {
      delete state.policies[name]
    }
  }
  return state
}
