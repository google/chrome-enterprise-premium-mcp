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
 * @file Interface for Google Cloud Identity API client wrappers.
 */

/**
 * @interface CloudIdentityClient
 */
export class CloudIdentityClient {
  /**
   * Lists DLP rules for a given customer.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<Array<object>>} - A list of policies.
   * @throws {Error} - If the API call fails.
   */
  async listDlpRules(_authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Lists detectors for a given customer.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<Array<object>>} - A list of policies.
   * @throws {Error} - If the API call fails.
   */
  async listDetectors(_authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Creates a new Chrome DLP Rule.
   * @param {string} _customerId - The customer ID.
   * @param {string} _orgUnitId - The organizational unit ID.
   * @param {object} _ruleConfig - Configuration for the new rule.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<object>} - The created rule.
   */
  async createDlpRule(_customerId, _orgUnitId, _ruleConfig, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Deletes a DLP rule policy.
   * @param {string} _policyName - The name of the policy to delete.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<object>} - The result of the deletion.
   * @throws {Error} - If the API call fails.
   */
  async deleteDlpRule(_policyName, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Creates a new Detector.
   * @param {string} _customerId - The customer ID.
   * @param {string} _orgUnitId - The organizational unit ID.
   * @param {object} _detectorConfig - Configuration for the new detector.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<object>} - The created detector.
   * @throws {Error} - If the API call fails.
   */
  async createDetector(_customerId, _orgUnitId, _detectorConfig, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Deletes a Detector policy.
   * @param {string} _policyName - The name of the detector policy to delete.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<object>} - The result of the deletion.
   * @throws {Error} - If the API call fails.
   */
  async deleteDetector(_policyName, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Gets a DLP rule policy.
   * @param {string} _policyName - The name of the policy to retrieve.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<object>} - The retrieved policy.
   * @throws {Error} - If the API call fails.
   */
  async getDlpRule(_policyName, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Gets a detector policy.
   * @param {string} _policyName - The name of the detector policy to retrieve.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<object>} - The retrieved detector.
   * @throws {Error} - If the API call fails.
   */
  async getDetector(_policyName, _authToken) {
    throw new Error('Not implemented')
  }
}
