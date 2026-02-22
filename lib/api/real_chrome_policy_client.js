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
 * @fileoverview Real implementation of the ChromePolicyClient interface using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry } from '../util/helpers.js'
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

export class RealChromePolicyClient extends ChromePolicyClient {
  constructor(apiOptions = {}) {
    super()
    this.apiOptions = apiOptions
  }

  async getClient(authToken) {
    return createApiClient(
      google.chromepolicy,
      API_VERSIONS.CHROME_POLICY,
      [SCOPES.CHROME_MANAGEMENT_POLICY],
      authToken,
      this.apiOptions,
    )
  }

  async getConnectorPolicy(customerId, orgUnitId, policySchemaFilter, authToken) {
    logger.debug(
      `${TAGS.API} getConnectorPolicy called with customerId: ${customerId}, orgUnitId: ${orgUnitId}, policySchemaFilter: ${policySchemaFilter}`,
    )
    if (!customerId) {
      throw new Error('customerId is required for getConnectorPolicy')
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
      return response.data.resolvedPolicies
    } catch (error) {
      logger.error(`${TAGS.API} ✗ Error getting connector policy:`, error)
      throw error
    }
  }
}
