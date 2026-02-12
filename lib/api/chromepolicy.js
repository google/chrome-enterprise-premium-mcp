/**
 * @fileoverview Google Chrome Policy API client wrapper.
 *
 * Provides functions to:
 * - Retrieve connector policies (DLP, Content Analysis).
 * - Resolve policies for specific organizational units.
 */

import { google } from 'googleapis';

import { getAuthClient } from '../util/auth.js';
import { callWithRetry } from '../util/helpers.js';
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js';

let chromePolicyClient;


/**
 * Initializes or returns the cached Chrome Policy API client.
 *
 * @param {string} [authToken] - Optional OAuth token
 * @returns {Promise<object>} The Chrome Policy API client instance
 */
async function getChromePolicyClient(authToken) {
  if (chromePolicyClient) {
    return chromePolicyClient;
  }

  const authClient = await getAuthClient(
    [SCOPES.CHROME_MANAGEMENT_POLICY],
    authToken
  );

  google.options({ auth: authClient });
  chromePolicyClient = google.chromepolicy(API_VERSIONS.CHROME_POLICY);
  
  return chromePolicyClient;
}


/**
 * @typedef {object} ConnectorPolicyFilter
 * @property {string} ON_FILE_ATTACHED - Filter for file attachment policies
 * @property {string} ON_FILE_DOWNLOAD - Filter for file download policies
 * @property {string} ON_BULK_TEXT_ENTRY - Filter for bulk text entry policies
 * @property {string} ON_PRINT - Filter for print analysis policies
 * @property {string} ON_REALTIME_URL_NAVIGATION - Filter for realtime URL check policies
 * @property {string} ON_SECURITY_EVENT - Filter for security event reporting policies
 */
export const ConnectorPolicyFilter = {
  ON_FILE_ATTACHED: 'chrome.users.OnFileAttachedConnectorPolicy',
  ON_FILE_DOWNLOAD: 'chrome.users.OnFileDownloadedConnectorPolicy',
  ON_BULK_TEXT_ENTRY: 'chrome.users.OnBulkTextEntryConnectorPolicy',
  ON_PRINT: 'chrome.users.OnPrintAnalysisConnectorPolicy',
  ON_REALTIME_URL_NAVIGATION: 'chrome.users.RealtimeUrlCheck',
  ON_SECURITY_EVENT: 'chrome.users.OnSecurityEvent',
};


/**
 * Retrieves the connector policy for a specific customer and organizational unit.
 *
 * @param {string} customerId - The Google Workspace Customer ID (e.g. C012345)
 * @param {string} orgUnitId - The Organizational Unit ID to resolve the policy for
 * @param {string} policySchemaFilter - The specific policy schema to filter (use ConnectorPolicyFilter enum)
 * @param {function(object): void} [progressCallback] - Optional callback for progress updates
 * @param {string} [authToken] - Optional OAuth token
 * @returns {Promise<Array<object>>} A promise that resolves to a list of resolved policies
 * @throws {Error} If the API call fails
 */
export async function getConnectorPolicy(
  customerId,
  orgUnitId,
  policySchemaFilter,
  progressCallback,
  authToken
) {
  if (!customerId) {
    throw new Error('customerId is required for getConnectorPolicy');
  }

  const client = await getChromePolicyClient(authToken);
  
  try {
    const message = `Getting connector policy for customer ${customerId} and org unit ${orgUnitId}...`;
    console.error(`${TAGS.API} ${message}`);
    progressCallback?.({ level: 'info', data: message });

    const request = {
      customer: `customers/${customerId}`,
      requestBody: {
        policyTargetKey: {
          targetResource: `orgunits/${orgUnitId}`,
        },
        policySchemaFilter,
      },
    };

    const response = await callWithRetry(
      () => client.customers.policies.resolve(request),
      'policies.resolve'
    );

    return response.data.resolvedPolicies;
  } catch (error) {
    console.error(`${TAGS.API} ✗ Error getting connector policy:`, error);
    throw error;
  }
}