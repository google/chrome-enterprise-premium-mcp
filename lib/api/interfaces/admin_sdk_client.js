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
 * @fileoverview Interface for Google Workspace Admin SDK API client wrappers.
 */

/**
 * @interface AdminSdkClient
 */
export class AdminSdkClient {
  /**
   * Retrieves the customer ID for the authenticated user.
   * @param {string} [authToken] - Optional OAuth token
   * @returns {Promise<object>} A promise that resolves to the customer object containing the ID
   * @throws {Error} If the API call fails
   */
  async getCustomerId(authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Lists all organizational units for the current customer.
   * @param {object} options - Options
   * @param {string} [options.customerId] - The customer ID to list OUs for
   * @param {string} [authToken] - Optional OAuth token
   * @returns {Promise<object>} A promise that resolves to the list of organizational units
   * @throws {Error} If the API call fails
   */
  async listOrgUnits(options, authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Lists Chrome activity logs.
   * @param {object} options - Filter options for the activity log query
   * @param {string} [authToken] - Optional OAuth token
   * @returns {Promise<Array<object>>} A promise that resolves to an array of activity items
   * @throws {Error} If the API call fails
   */
  async listChromeActivities(options, authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Checks if the customer has a Chrome Enterprise Premium subscription.
   * @param {string} customerId - The customer ID
   * @param {string} [authToken] - Optional OAuth token
   * @returns {Promise<object>} A promise that resolves to the licensing information
   * @throws {Error} If the API call fails
   */
  async checkCepSubscription(customerId, authToken) {
    throw new Error('Not implemented')
  }
}
