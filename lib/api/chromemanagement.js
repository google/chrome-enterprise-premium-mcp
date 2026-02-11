
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
import { getAuthClient } from '../util/auth.js';
import { callWithRetry } from '../util/helpers.js';

let managementClient;

async function getManagementClient(authToken) {
  if (managementClient) {
    return managementClient;
  }
  const authClient = await getAuthClient(
    ['https://www.googleapis.com/auth/chrome.management.reports.readonly'],
    authToken
  );
  google.options({ auth: authClient });
  managementClient = google.chromemanagement('v1');
  return managementClient;
}

/**
 * Counts browser versions for a given customer and optional Org Unit.
 * @param {string} projectId - The Google Cloud project ID.
 * @param {string} customerId - The customer ID (e.g. C012345).
 * @param {string} [orgUnitId] - The Org Unit ID to filter on.
 * @param {function(object): void} [progressCallback] - Optional callback for progress updates.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of browser version counts.
 */
export async function countBrowserVersions(
  projectId,
  customerId,
  orgUnitId,
  progressCallback
) {
  const client = await getManagementClient();
  try {
    console.log(`Counting browser versions for customer ${customerId}...`);
    const request = {
      customer: `customers/${customerId}`,
    };
    if (orgUnitId) {
      request.orgUnitId = orgUnitId;
    }
    const response = await callWithRetry(
      () => client.customers.reports.countChromeVersions(request),
      'reports.countChromeVersions'
    );
    return response.data.browserVersions;
  } catch (error) {
    console.error(`Error counting browser versions:`, error);
    throw error;
  }
}

/**
 * Lists customer profiles for a given customer.
 * @param {string} customerId - The customer ID (e.g. C012345).
 * @param {function(object): void} [progressCallback] - Optional callback for progress updates.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of customer profiles.
 */
export async function listCustomerProfiles(customerId, progressCallback) {
  const client = await getManagementClient();
  try {
    console.log(`Listing customer profiles for customer ${customerId}...`);
    const request = {
      parent: `customers/${customerId}`,
    };

    const response = await callWithRetry(
      () => client.customers.profiles.list(request),
      'profiles.list'
    );
    return response.data.chromeBrowserProfiles;
  } catch (error) {
    console.error(`Error listing customer profiles:`, error);
    throw error;
  }
}
