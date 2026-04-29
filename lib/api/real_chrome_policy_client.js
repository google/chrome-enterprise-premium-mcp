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
 * @file Real implementation of the ChromePolicyClient interface using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'
import { ChromePolicyClient } from './interfaces/chrome_policy_client.js'
import { logger } from '../util/logger.js'

export const ConnectorPolicyFilter = {
  ON_FILE_ATTACHED: 'chrome.users.OnFileAttachedConnectorPolicy',
  ON_FILE_DOWNLOAD: 'chrome.users.OnFileDownloadedConnectorPolicy',
  ON_BULK_TEXT_ENTRY: 'chrome.users.OnBulkTextEntryConnectorPolicy',
  ON_PRINT: 'chrome.users.OnPrintAnalysisConnectorPolicy',
  ON_REALTIME_URL_NAVIGATION: 'chrome.users.RealtimeUrlCheck',
  ON_SECURITY_EVENT: 'chrome.users.OnSecurityEvent',
}

/**
 * Real implementation of the ChromePolicyClient interface.
 */
export class RealChromePolicyClient extends ChromePolicyClient {
  /**
   * Initializes the RealChromePolicyClient.
   * @param {object} [apiOptions] Configuration options for the API client.
   */
  constructor(apiOptions = {}) {
    super()
    this.apiOptions = apiOptions
  }

  /**
   * Gets an authenticated Chrome Policy API client.
   * @param {import('../util/credential/index.js').Credential} credential Credential for API authentication.
   * @returns {Promise<object>} The Chrome Policy API client.
   */
  async getChromePolicyService(credential) {
    return createApiClient(
      google.chromepolicy,
      API_VERSIONS.CHROME_POLICY,
      [SCOPES.CHROME_MANAGEMENT_POLICY],
      credential,
      this.apiOptions,
    )
  }

  /**
   * Retrieves a connector policy for a customer and organizational unit.
   * @param {string} customerId The ID of the customer.
   * @param {string} orgUnitId The ID of the organizational unit.
   * @param {string} policySchemaFilter The policy schema filter to apply.
   * @param {import('../util/credential/index.js').Credential} [credential] Credential for API authentication.
   * @returns {Promise<Array<object>>} An array of resolved policies.
   */
  async getConnectorPolicy(customerId, orgUnitId, policySchemaFilter, credential) {
    return this.resolvePolicy(customerId, orgUnitId, policySchemaFilter, credential)
  }

  /**
   * Resolves policies for a specific target.
   * @param {string} customerId The ID of the customer.
   * @param {string} orgUnitId The ID of the organizational unit.
   * @param {string} policySchemaFilter The policy schema filter to apply.
   * @param {import('../util/credential/index.js').Credential} [credential] Credential for API authentication.
   * @returns {Promise<Array<object>>} An array of resolved policies.
   * @throws {Error} If customerId is missing or if the API call fails.
   */
  async resolvePolicy(customerId, orgUnitId, policySchemaFilter, credential) {
    logger.debug(
      `${TAGS.API} resolvePolicy called with customerId: ${customerId}, orgUnitId: ${orgUnitId}, policySchemaFilter: ${policySchemaFilter}`,
    )
    if (!customerId) {
      throw new Error('customerId is required for resolvePolicy')
    }
    const client = await this.getChromePolicyService(credential)
    try {
      const request = {
        customer: `customers/${customerId}`,
        requestBody: {
          policyTargetKey: {
            targetResource: `orgunits/${orgUnitId}`,
          },
          policySchemaFilter,
        },
      }
      const response = await callWithRetry(() => client.customers.policies.resolve(request), 'policies.resolve')
      return response.data.resolvedPolicies || []
    } catch (error) {
      const status = error.status || error.code || error.response?.status
      if (status === 404) {
        return []
      }
      handleApiError(error, TAGS.API, 'resolving policy')
    }
  }

  /**
   * Batch modifies policies for a specific target.
   * @param {string} customerId The ID of the customer.
   * @param {string} orgUnitId The ID of the organizational unit.
   * @param {Array<object>} requests The batch of policy modification requests.
   * @param {import('../util/credential/index.js').Credential} [credential] Credential for API authentication.
   * @returns {Promise<object>} The API response data.
   * @throws {Error} If customerId is missing or if the API call fails.
   */
  async batchModifyPolicy(customerId, orgUnitId, requests, credential) {
    logger.debug(`${TAGS.API} batchModifyPolicy called with customerId: ${customerId}, orgUnitId: ${orgUnitId}`)
    if (!customerId) {
      throw new Error('customerId is required for batchModifyPolicy')
    }
    const client = await this.getChromePolicyService(credential)
    try {
      const request = {
        customer: `customers/${customerId}`,
        requestBody: {
          requests,
        },
      }
      const response = await callWithRetry(
        () => client.customers.policies.orgunits.batchModify(request),
        'policies.orgunits.batchModify',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'batch modifying policies')
    }
  }
}
