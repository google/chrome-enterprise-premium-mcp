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
 * @fileoverview Scenario: multiple faults in the environment simultaneously.
 *
 * Combines missing download connector, missing SEB extension, and an
 * unlicensed user. Tests whether the agent can identify multiple issues
 * in a single diagnostic sweep.
 */

/** @param {object} state - Cloned base state. */
export function mutate(state) {
  // Remove download connector
  state.globalConnectorPolicies['chrome.users.OnFileDownloadedConnectorPolicy'] = []
  // Remove SEB extension
  state.globalConnectorPolicies['chrome.users.apps.InstallType'] = []
  // Remove bob's license
  state.licenses.C04x8k2m9[101040][1010400001] = state.licenses.C04x8k2m9[101040][1010400001].filter(
    l => l.userId !== 'bob@example.com',
  )
  return state
}
