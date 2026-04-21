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
 * @file Google Chrome Policy API client wrapper.
 *
 * Provides functions to:
 * - Retrieve connector policies (DLP, Content Analysis).
 * - Resolve policies for specific organizational units.
 */

import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'
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
 * Initializes or returns the cached Chrome Policy API client.
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<object>} The Chrome Policy API client instance
 * @throws {Error} If the API client creation fails
 */
async function getChromePolicyClient(authToken, apiOptions) {
  return createApiClient(
    google.chromepolicy,
    API_VERSIONS.CHROME_POLICY,
    [SCOPES.CHROME_MANAGEMENT_POLICY],
    authToken,
    apiOptions,
  )
}

/**
 * Retrieves the connector policy for a specific customer and organizational unit.
 * @param {string} customerId - The Google Workspace Customer ID (e.g. C012345)
 * @param {string} orgUnitId - The Organizational Unit ID to resolve the policy for
 * @param {string} policySchemaFilter - The specific policy schema to filter (use ConnectorPolicyFilter enum)
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<Array<object>>} A list of resolved policies
 * @throws {Error} If the API call fails
 */
export async function getConnectorPolicy(customerId, orgUnitId, policySchemaFilter, authToken, apiOptions = {}) {
  if (!customerId) {
    throw new Error('customerId is required for getConnectorPolicy')
  }

  const client = await getChromePolicyClient(authToken, apiOptions)

  try {
    const message = `Getting connector policy for customer ${customerId} and org unit ${orgUnitId}...`
    logger.info(`${TAGS.API} ${message}`)

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
    logger.error(`${TAGS.API} Error getting connector policy:`, error)
    throw error
  }
}
