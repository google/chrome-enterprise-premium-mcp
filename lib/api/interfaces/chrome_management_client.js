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
 * @file Interface for Google Chrome Management API client wrappers.
 */

/**
 * @interface ChromeManagementClient
 */
export class ChromeManagementClient {
  /**
   * Counts Chrome browser versions for a specific customer.
   * @param {string} _customerId - The customer ID.
   * @param {string} [_orgUnitId] - Optional organizational unit ID.
   * @returns {Promise<Array<object>>} - A promise that resolves to an array of browser version counts.
   * @throws {Error} - If the API call fails.
   */
  async countBrowserVersions(_customerId, _orgUnitId) {
    throw new Error('Not implemented')
  }

  /**
   * Lists Chrome browser profiles for a specific customer.
   * @param {string} _customerId - The customer ID.
   * @returns {Promise<Array<object>>} - A promise that resolves to an array of customer profiles.
   * @throws {Error} - If the API call fails.
   */
  async listCustomerProfiles(_customerId) {
    throw new Error('Not implemented')
  }
}
