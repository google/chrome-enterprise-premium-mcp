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

import { google } from 'googleapis';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { callWithRetry } from '../util/helpers.js';

let chromePolicyClient;

/**
 * Gets the Chrome Policy client.
 * @param {string} [authToken] - Optional OAuth token.
 * @returns {Promise<object>} - A promise that resolves to the Chrome Policy client.
 */
async function getChromePolicyClient(authToken) {
  if (authToken) {
    console.log(`Using OAuth token for chrome policy client.`);
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: authToken });
    google.options({ auth: auth });
    console.log(`Initialized chromepolicy client with OAuth token.`);
    return google.chromepolicy('v1');
  }

  if (chromePolicyClient) {
    return chromePolicyClient;
  }
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/chrome.management.policy'],
  });
  const authClient = await auth.getClient();
  google.options({ auth: authClient });

  chromePolicyClient = google.chromepolicy('v1');
  console.log(`Initialized chromepolicy client.`);
  return chromePolicyClient;
}

/**
 * Enum for connector policy filters.
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
 * Gets connector policy for a given customer and Org Unit.
 * @param {string} customerId - The customer ID (e.g. C012345).
 * @param {string} orgUnitId - The Org Unit ID to filter on.
 * @param {string} policySchemaFilter - The policy schema filter from ConnectorPolicyFilter enum.
 * @param {function(object): void} [progressCallback] - Optional callback for progress updates.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of policies.
 */
export async function getConnectorPolicy(customerId, orgUnitId, policySchemaFilter, progressCallback, authToken) {
  const client = await getChromePolicyClient(authToken);
  try {
    console.log(`Getting connector policy for customer ${customerId} and org unit ${orgUnitId}...`);
    const request = {
      customer: `customers/${customerId}`,
      requestBody: {
        policyTargetKey: {
          targetResource: `orgunits/${orgUnitId}`,
        },
        policySchemaFilter: policySchemaFilter,
      }
    };
    const response = await callWithRetry(
      () => client.customers.policies.resolve(request),
      'policies.resolve'
    );
    return response.data.resolvedPolicies;
  } catch (error) {
    console.error(`Error getting connector policy:`, error);
    throw error;
  }
}
