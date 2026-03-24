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
 * @fileoverview Interface for Google Chrome Policy API client wrappers.
 */

/**
 * @interface ChromePolicyClient
 */
export class ChromePolicyClient {
  /**
   * Retrieves the connector policy for a specific customer and organizational unit.
   * @param {string} customerId
   * @param {string} orgUnitId
   * @param {string} policySchemaFilter
   * @param {string} [authToken]
   * @returns {Promise<Array<object>>}
   * @throws {Error}
   */
  async getConnectorPolicy(customerId, orgUnitId, policySchemaFilter, authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Resolves policies for a specific target.
   * @param {string} customerId
   * @param {string} orgUnitId
   * @param {string} policySchemaFilter
   * @param {string} [authToken]
   * @returns {Promise<Array<object>>}
   */
  async resolvePolicy(customerId, orgUnitId, policySchemaFilter, authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Modifies policies for a specific target.
   * @param {string} customerId
   * @param {string} orgUnitId
   * @param {Array<object>} requests
   * @param {string} [authToken]
   * @returns {Promise<object>}
   */
  async batchModifyPolicy(customerId, orgUnitId, requests, authToken) {
    throw new Error('Not implemented')
  }
}
