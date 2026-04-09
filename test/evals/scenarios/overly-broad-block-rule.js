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
 * @fileoverview Scenario: block rule has overly broad triggers and condition.
 *
 * Used by: pr11 (prompt maturity), pr14 (prompt noise).
 */

/** @param {object} state - Cloned base state. */
export function mutate(state) {
  const rule = state.policies['policies/dlpBlock1'].setting.value
  rule.displayName = 'Block all sensitive content'
  rule.triggers = [
    'google.workspace.chrome.file.v1.upload',
    'google.workspace.chrome.file.v1.download',
    'google.workspace.chrome.web_content.v1.upload',
    'google.workspace.chrome.page.v1.print',
    'google.workspace.chrome.url.v1.navigation',
  ]
  rule.condition = { contentCondition: 'all_content.matches(".*")' }
  return state
}
