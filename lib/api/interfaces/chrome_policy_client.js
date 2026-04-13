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
 * @file Interface for Google Chrome Policy API client wrappers.
 */

/**
 * @interface ChromePolicyClient
 */
export class ChromePolicyClient {
  /**
   * Retrieves the connector policy for a specific customer and organizational unit.
   * @param {string} _customerId - The customer ID.
   * @param {string} _orgUnitId - The organizational unit ID.
   * @param {string} _policySchemaFilter - Filter for policy schemas.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<Array<object>>} - A promise that resolves to an array of connector policies.
   * @throws {Error} - If the API call fails.
   */
  async getConnectorPolicy(_customerId, _orgUnitId, _policySchemaFilter, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Resolves policies for a specific target.
   * @param {string} _customerId - The customer ID.
   * @param {string} _orgUnitId - The organizational unit ID.
   * @param {string} _policySchemaFilter - Filter for policy schemas.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<Array<object>>} - A promise that resolves to an array of resolved policies.
   */
  async resolvePolicy(_customerId, _orgUnitId, _policySchemaFilter, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Modifies policies for a specific target.
   * @param {string} _customerId - The customer ID.
   * @param {string} _orgUnitId - The organizational unit ID.
   * @param {Array<object>} _requests - Array of policy modification requests.
   * @param {string} [_authToken] - Optional OAuth token.
   * @returns {Promise<object>} - A promise that resolves to the result of the batch modification.
   */
  async batchModifyPolicy(_customerId, _orgUnitId, _requests, _authToken) {
    throw new Error('Not implemented')
  }
}
