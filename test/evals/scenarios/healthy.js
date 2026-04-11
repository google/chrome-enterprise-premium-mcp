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
 * @fileoverview Scenario: healthy environment (no mutations).
 *
 * Returns the base state unchanged. Used by evals that test
 * the agent's behavior in a fully configured environment.
 */

/** @param {object} state - Cloned base state (returned as-is). */
export function mutate(state) {
  return state
}
