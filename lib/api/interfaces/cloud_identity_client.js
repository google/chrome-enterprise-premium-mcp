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
 * @fileoverview Interface for Google Cloud Identity API client wrappers.
 */

/**
 * @interface CloudIdentityClient
 */
export class CloudIdentityClient {
  /**
   * Lists DLP rules or detectors for a given customer.
   * @param {string} type - The policy type to filter ('rule' or 'detector')
   * @param {string} [authToken] - Optional OAuth token
   * @returns {Promise<Array<object>>} A promise that resolves to a list of policies
   * @throws {Error} If the API call fails
   */
  async listDlpPolicies(type, authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Creates a new Chrome DLP Rule.
   * @param {string} customerId
   * @param {string} orgUnitId
   * @param {object} ruleConfig
   * @param {boolean} [validateOnly=false]
   * @param {string} [authToken]
   * @returns {Promise<object>}
   * @throws {Error}
   */
  async createDlpRule(customerId, orgUnitId, ruleConfig, validateOnly = false, authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Deletes a DLP policy.
   * @param {string} policyName
   * @param {string} [authToken]
   * @returns {Promise<object>}
   * @throws {Error}
   */
  async deleteDlpRule(policyName, authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Creates a new URL blocking list.
   * @param {string} customerId
   * @param {string} orgUnitId
   * @param {object} urlListConfig
   * @param {string} [authToken]
   * @returns {Promise<object>}
   * @throws {Error}
   */
  async createUrlList(customerId, orgUnitId, urlListConfig, authToken) {
    throw new Error('Not implemented')
  }
}
