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
   * Lists DLP rules for a given customer.
   * @param {string} [authToken] - Optional OAuth token
   * @returns {Promise<Array<object>>} A promise that resolves to a list of policies
   * @throws {Error} If the API call fails
   */
  async listDlpRules(_authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Lists detectors for a given customer.
   * @param {string} [authToken] - Optional OAuth token
   * @returns {Promise<Array<object>>} A promise that resolves to a list of policies
   * @throws {Error} If the API call fails
   */
  async listDetectors(_authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Creates a new Chrome DLP Rule.
   * @param {string} customerId
   * @param {string} orgUnitId
   * @param {object} ruleConfig
   * @param {string} [authToken]
   * @returns {Promise<object>}
   */
  async createDlpRule(_customerId, _orgUnitId, _ruleConfig, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Deletes a DLP rule policy.
   * @param {string} policyName
   * @param {string} [authToken]
   * @returns {Promise<object>}
   * @throws {Error}
   */
  async deleteDlpRule(_policyName, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Creates a new Detector.
   * @param {string} customerId
   * @param {string} orgUnitId
   * @param {object} detectorConfig
   * @param {string} [authToken]
   * @returns {Promise<object>}
   * @throws {Error}
   */
  async createDetector(_customerId, _orgUnitId, _detectorConfig, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Deletes a Detector policy.
   * @param {string} policyName
   * @param {string} [authToken]
   * @returns {Promise<object>}
   * @throws {Error}
   */
  async deleteDetector(_policyName, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Gets a DLP rule policy.
   * @param {string} policyName
   * @param {string} [authToken]
   * @returns {Promise<object>}
   * @throws {Error}
   */
  async getDlpRule(_policyName, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Gets a detector policy.
   * @param {string} policyName
   * @param {string} [authToken]
   * @returns {Promise<object>}
   * @throws {Error}
   */
  async getDetector(_policyName, _authToken) {
    throw new Error('Not implemented')
  }
}
