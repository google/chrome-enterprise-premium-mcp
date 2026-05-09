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
 * @fileoverview Scenario: browser fleet has outdated versions.
 *
 * Most devices are running a version 2+ major releases behind
 * the current stable channel. Tests whether the agent flags
 * version drift during health checks.
 *
 * Used by: i07 (inspection).
 */

/** @param {object} state - Cloned base state. */
export function mutate(state) {
  state.browserVersions = [
    { version: '120.0.6099.71', count: '87', channel: 'STABLE' },
    { version: '130.0.6723.58', count: '12', channel: 'STABLE' },
    { version: '134.0.6998.45', count: '3', channel: 'STABLE' },
  ]
  return state
}
