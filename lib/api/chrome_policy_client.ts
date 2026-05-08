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
 * @file Chrome Policy API client wrapper using googleapis.
 */

import { google, chromepolicy_v1 } from 'googleapis'
import { createApiClient, ApiOptions } from '../util/api-client.js'
import { callWithRetry, handleApiError, isApiError, isObject } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

export const ConnectorPolicyFilter = {
  ON_FILE_ATTACHED: 'chrome.users.OnFileAttachedConnectorPolicy',
  ON_FILE_DOWNLOAD: 'chrome.users.OnFileDownloadedConnectorPolicy',
  ON_BULK_TEXT_ENTRY: 'chrome.users.OnBulkTextEntryConnectorPolicy',
  ON_PRINT: 'chrome.users.OnPrintAnalysisConnectorPolicy',
  ON_REALTIME_URL_NAVIGATION: 'chrome.users.RealtimeUrlCheck',
  ON_SECURITY_EVENT: 'chrome.users.OnSecurityEvent',
} as const

/**
 * Chrome Policy API client wrapper using googleapis.
 */
export class ChromePolicyClient {
  private apiOptions: ApiOptions

  /**
   * Initializes the ChromePolicyClient.
   * @param apiOptions Configuration options for the API client.
   */
  constructor(apiOptions: ApiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Gets an authenticated Chrome Policy API client.
   * @param authToken Optional authentication token.
   * @returns The Chrome Policy API client.
   */
  async getClient(authToken?: string): Promise<chromepolicy_v1.Chromepolicy> {
    return createApiClient<chromepolicy_v1.Chromepolicy>(
      options => google.chromepolicy({ ...options, version: 'v1' }),
      API_VERSIONS.CHROME_POLICY,
      [SCOPES.CHROME_MANAGEMENT_POLICY],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Retrieves a connector policy for a customer and organizational unit.
   * @param customerId The ID of the customer.
   * @param orgUnitId The ID of the organizational unit.
   * @param policySchemaFilter The policy schema filter to apply.
   * @param authToken Optional authentication token.
   * @returns An array of resolved policies.
   */
  async getConnectorPolicy(
    customerId: string,
    orgUnitId: string,
    policySchemaFilter: string,
    authToken?: string,
  ): Promise<chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy[]> {
    return this.resolvePolicy(customerId, orgUnitId, policySchemaFilter, authToken)
  }

  /**
   * Resolves policies for a specific target.
   * @param customerId The ID of the customer.
   * @param orgUnitId The ID of the organizational unit.
   * @param policySchemaFilter The policy schema filter to apply.
   * @param authToken Optional authentication token.
   * @returns An array of resolved policies.
   * @throws {Error} If customerId is missing or if the API call fails.
   */
  async resolvePolicy(
    customerId: string,
    orgUnitId: string,
    policySchemaFilter: string,
    authToken?: string,
  ): Promise<chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ResolvedPolicy[]> {
    logger.debug(
      `${TAGS.API} resolvePolicy called with customerId: ${customerId}, orgUnitId: ${orgUnitId}, policySchemaFilter: ${policySchemaFilter}`,
    )
    if (!customerId) {
      throw new Error('customerId is required for resolvePolicy')
    }
    const client = await this.getClient(authToken)
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
      const status =
        isObject(error) && typeof error['status'] === 'number'
          ? error['status']
          : isApiError(error)
            ? error.response?.status
            : undefined
      if (status === 404) {
        return []
      }
      handleApiError(error, TAGS.API, 'resolving policy')
    }
  }

  /**
   * Batch modifies policies for a specific target.
   * @param customerId The ID of the customer.
   * @param orgUnitId The ID of the organizational unit.
   * @param requests The batch of policy modification requests.
   * @param authToken Optional authentication token.
   * @returns The API response data.
   * @throws {Error} If customerId is missing or if the API call fails.
   */
  async batchModifyPolicy(
    customerId: string,
    orgUnitId: string,
    requests: chromepolicy_v1.Schema$GoogleChromePolicyVersionsV1ModifyOrgUnitPolicyRequest[],
    authToken?: string,
  ): Promise<unknown> {
    logger.debug(`${TAGS.API} batchModifyPolicy called with customerId: ${customerId}, orgUnitId: ${orgUnitId}`)
    if (!customerId) {
      throw new Error('customerId is required for batchModifyPolicy')
    }
    const client = await this.getClient(authToken)
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
