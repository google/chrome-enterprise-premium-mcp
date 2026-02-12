/**
 * @fileoverview Google Workspace Admin SDK API client wrapper.
 *
 * Provides functions to:
 * - List Chrome activity logs.
 * - List organizational units (OUs).
 * - Retrieve customer details.
 */

import { google } from 'googleapis';

import { getAuthClient } from '../util/auth.js';
import { callWithRetry } from '../util/helpers.js';
import { API_VERSIONS, SCOPES } from '../constants.js';

// The customer ID for the current authenticated user.
const CURRENT_CUSTOMER = 'my_customer';


/**
 * Lists Chrome activity logs for a specific user and event filter.
 *
 * @param {object} options - Filter options for the activity log query
 * @param {string} [options.userKey='all'] - The user key to filter by (default: 'all')
 * @param {string} [options.eventName] - specific event name to filter by
 * @param {string} [options.startTime] - Start time in RFC3339 format
 * @param {string} [options.endTime] - End time in RFC3339 format
 * @param {number} [options.maxResults] - Maximum number of results to return
 * @param {string} [options.customerId] - The customer ID to query for (default: 'my_customer')
 * @param {string} [authToken] - Optional OAuth token
 * @returns {Promise<Array<object>>} A promise that resolves to an array of activity items
 * @throws {Error} If the API call fails
 */
export async function listChromeActivities(options, authToken) {
  const authClient = await getAuthClient(
    [SCOPES.ADMIN_REPORTS_AUDIT_READONLY],
    authToken
  );
  
  const service = google.admin({ 
    version: API_VERSIONS.ADMIN_REPORTS, 
    auth: authClient 
  });

  const response = await callWithRetry(
    () => service.activities.list({
      userKey: options.userKey || 'all',
      applicationName: 'chrome',
      eventName: options.eventName,
      startTime: options.startTime,
      endTime: options.endTime,
      maxResults: options.maxResults,
      customerId: options.customerId || CURRENT_CUSTOMER,
    }),
    'admin.activities.list'
  );

  return response.data.items;
}


/**
 * Lists all organizational units for the current customer.
 *
 * @param {object} options - Options
 * @param {string} [options.customerId] - The customer ID to list OUs for (default: 'my_customer')
 * @param {string} [authToken] - Optional OAuth token
 * @returns {Promise<object>} A promise that resolves to the list of organizational units
 * @throws {Error} If the API call fails
 */
export async function listOrgUnits(options, authToken) {
  const authClient = await getAuthClient(
    [SCOPES.ADMIN_DIRECTORY_ORGUNIT_READONLY],
    authToken
  );
  
  const service = google.admin({ 
    version: API_VERSIONS.ADMIN_DIRECTORY, 
    auth: authClient 
  });

  const response = await callWithRetry(
    () => service.orgunits.list({
      customerId: options.customerId || CURRENT_CUSTOMER,
    }),
    'admin.orgunits.list'
  );

  return response.data;
}


/**
 * Retrieves the customer ID for the authenticated user.
 *
 * @param {string} [authToken] - Optional OAuth token
 * @returns {Promise<object>} A promise that resolves to the customer object containing the ID
 * @throws {Error} If the API call fails
 */
export async function getCustomerId(authToken) {
  const authClient = await getAuthClient(
    [SCOPES.ADMIN_DIRECTORY_CUSTOMER_READONLY],
    authToken
  );
  
  const service = google.admin({ 
    version: API_VERSIONS.ADMIN_DIRECTORY, 
    auth: authClient 
  });

  const response = await callWithRetry(
    () => service.customers.get({
      customerKey: CURRENT_CUSTOMER,
    }),
    'admin.customers.get'
  );

  return response.data;
}