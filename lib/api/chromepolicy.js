/**
 * @fileoverview Google Chrome Policy API client wrapper.
 *
 * Provides functions to:
 * - Retrieve connector policies (DLP, Content Analysis).
 * - Resolve policies for specific organizational units.
 */

import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'

export const ConnectorPolicyFilter = {
  ON_FILE_ATTACHED: 'chrome.users.OnFileAttachedConnectorPolicy',
  ON_FILE_DOWNLOAD: 'chrome.users.OnFileDownloadedConnectorPolicy',
  ON_BULK_TEXT_ENTRY: 'chrome.users.OnBulkTextEntryConnectorPolicy',
  ON_PRINT: 'chrome.users.OnPrintAnalysisConnectorPolicy',
  ON_REALTIME_URL_NAVIGATION: 'chrome.users.RealtimeUrlCheck',
  ON_SECURITY_EVENT: 'chrome.users.OnSecurityEvent',
}

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
 *
 * @param {string} customerId - The Google Workspace Customer ID (e.g. C012345)
 * @param {string} orgUnitId - The Organizational Unit ID to resolve the policy for
 * @param {string} policySchemaFilter - The specific policy schema to filter (use ConnectorPolicyFilter enum)
 * @param {function(object): void} [progressCallback] - Optional callback for progress updates
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions={}] - Options for API client creation
 * @returns {Promise<Array<object>>} A promise that resolves to a list of resolved policies
 * @throws {Error} If the API call fails
 */
export async function getConnectorPolicy(
  customerId,
  orgUnitId,
  policySchemaFilter,
  progressCallback,
  authToken,
  apiOptions = {},
) {
  if (!customerId) {
    throw new Error('customerId is required for getConnectorPolicy')
  }

  const client = await getChromePolicyClient(authToken, apiOptions)

  try {
    const message = `Getting connector policy for customer ${customerId} and org unit ${orgUnitId}...`
    console.error(`${TAGS.API} ${message}`)
    progressCallback?.({ level: 'info', data: message })

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
    console.error(`${TAGS.API} ✗ Error getting connector policy:`, error)
    throw error
  }
}
