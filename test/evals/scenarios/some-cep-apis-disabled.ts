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
 * @fileoverview Scenario: Some core CEP APIs are disabled (while others are enabled).
 */

/** @param {object} state - Cloned base state. */
export function mutate(state) {
  // Disabled APIs
  state.serviceUsage['chromemanagement.googleapis.com'] = 'DISABLED'
  state.serviceUsage['chromepolicy.googleapis.com'] = 'DISABLED'

  // Explicitly Enabled APIs
  state.serviceUsage['admin.googleapis.com'] = 'ENABLED'
  state.serviceUsage['cloudidentity.googleapis.com'] = 'ENABLED'
  state.serviceUsage['licensing.googleapis.com'] = 'ENABLED'
  state.serviceUsage['serviceusage.googleapis.com'] = 'ENABLED'

  return state
}
