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
 * @fileoverview Scenario: no CEP subscription at all.
 *
 * Tests the most critical failure: the organization has no
 * Chrome Enterprise Premium licenses assigned to anyone.
 */

/** @param {object} state - Cloned base state. */
export function mutate(state) {
  state.licenses = { C04x8k2m9: { 101040: { 1010400001: [] } } }
  return state
}
