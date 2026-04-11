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
 * @file Fake implementation of the ChromePolicyClient interface for testing.
 */
import axios from 'axios'
import { ChromePolicyClient } from './interfaces/chrome_policy_client.js'
import { TAGS } from '../constants.js'
import { URL } from 'url'
import { logger } from '../util/logger.js'

/**
 * Fake implementation of the ChromePolicyClient for testing purposes.
 * Simulates API calls to Chrome Policy services.
 */
export class FakeChromePolicyClient extends ChromePolicyClient {
  /**
   * Initializes the fake client with a root URL for the mock server.
   * @param {string} rootUrl The base URL of the mock policy service.
   */
  constructor(rootUrl) {
    super()
    this.rootUrl = rootUrl
  }

  /**
   * Retrieves the connector policy for a specific customer and organizational unit.
   * @param {string} customerId The unique identifier for the customer.
   * @param {string} orgUnitId The organizational unit ID to check.
   * @param {string} policySchemaFilter Filter for specific policy schemas.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object[]>} A promise that resolves to the resolved policies.
   */
  async getConnectorPolicy(customerId, orgUnitId, policySchemaFilter, _authToken) {
    return this.resolvePolicy(customerId, orgUnitId, policySchemaFilter, _authToken)
  }

  /**
   * Resolves policies for a specific target and schema filter.
   * @param {string} customerId The unique identifier for the customer.
   * @param {string} orgUnitId The organizational unit ID to resolve policies for.
   * @param {string} policySchemaFilter Filter for specific policy schemas.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object[]>} A promise that resolves to the resolved policies.
   */
  async resolvePolicy(customerId, orgUnitId, policySchemaFilter, _authToken) {
    const url = new URL(`/v1/customers/${customerId}/policies:resolve`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] POST ${url}`)
    const requestBody = {
      policyTargetKey: { targetResource: `orgunits/${orgUnitId}` },
      policySchemaFilter,
    }
    const response = await axios.post(url, requestBody)
    return response.data.resolvedPolicies
  }

  /**
   * Modifies multiple policies in a single batch operation.
   * @param {string} customerId The unique identifier for the customer.
   * @param {string} orgUnitId The organizational unit ID where policies will be modified.
   * @param {object[]} requests A list of policy modification requests.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object>} A promise that resolves to the modification results.
   */
  async batchModifyPolicy(customerId, orgUnitId, requests, _authToken) {
    const url = new URL(`/v1/customers/${customerId}/policies/orgunits:batchModify`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] POST ${url}`)
    const requestBody = {
      requests,
    }
    const response = await axios.post(url, requestBody)
    return response.data
  }
}
