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
 * @fileoverview Interface for Google Chrome Management API client wrappers.
 */

/**
 * @interface ChromeManagementClient
 */
export class ChromeManagementClient {
  /**
   * Counts Chrome browser versions for a specific customer.
   * @param {string} customerId
   * @param {string} [orgUnitId]
   * @param {function(object): void} [progressCallback]
   * @returns {Promise<Array<object>>}
   * @throws {Error}
   */
  async countBrowserVersions(customerId, orgUnitId, progressCallback) {
    throw new Error('Not implemented')
  }

  /**
   * Lists Chrome browser profiles for a specific customer.
   * @param {string} customerId
   * @param {function(object): void} [progressCallback]
   * @returns {Promise<Array<object>>}
   * @throws {Error}
   */
  async listCustomerProfiles(customerId, progressCallback) {
    throw new Error('Not implemented')
  }
}
