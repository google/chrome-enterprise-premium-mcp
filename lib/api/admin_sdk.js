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
 * @file Google Workspace Admin SDK API client wrapper.
 *
 * Provides functions to:
 * - List Chrome activity logs.
 * - List organizational units (OUs).
 * - Retrieve customer details.
 */

import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry } from '../util/helpers.js'
import { API_VERSIONS, SCOPES, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

const CURRENT_CUSTOMER = 'my_customer'

/**
 * Lists Chrome activity logs for a specific user and event filter.
 * @param {object} options - Filter options for the activity log query
 * @param {string} [options.userKey] - The user key to filter by (default: 'all')
 * @param {string} [options.eventName] - specific event name to filter by
 * @param {string} [options.startTime] - Start time in RFC3339 format
 * @param {string} [options.endTime] - End time in RFC3339 format
 * @param {number} [options.maxResults] - Maximum number of results to return
 * @param {string} [options.customerId] - The customer ID to query for (default: 'my_customer')
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<Array<object>>} A promise that resolves to an array of activity items
 * @throws {Error} If the API call fails
 */
export async function listChromeActivities(options, authToken, apiOptions = {}) {
  const service = await createApiClient(
    google.admin,
    API_VERSIONS.ADMIN_REPORTS,
    [SCOPES.ADMIN_REPORTS_AUDIT_READONLY],
    authToken,
    apiOptions,
  )

  const response = await callWithRetry(
    () =>
      service.activities.list({
        userKey: options.userKey || 'all',
        applicationName: 'chrome',
        eventName: options.eventName,
        startTime: options.startTime,
        endTime: options.endTime,
        maxResults: options.maxResults,
        customerId: options.customerId || CURRENT_CUSTOMER,
      }),
    'admin.activities.list',
  )
  return response.data.items
}

/**
 * Lists all organizational units for the current customer.
 * @param {object} options - Options
 * @param {string} [options.customerId] - The customer ID to list OUs for (default: 'my_customer')
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<object>} A promise that resolves to the list of organizational units
 * @throws {Error} If the API call fails
 */
export async function listOrgUnits(options, authToken, apiOptions = {}) {
  const service = await createApiClient(
    google.admin,
    API_VERSIONS.ADMIN_DIRECTORY,
    [SCOPES.ADMIN_DIRECTORY_ORGUNIT_READONLY],
    authToken,
    apiOptions,
  )

  const response = await callWithRetry(
    () =>
      service.orgunits.list({
        customerId: options.customerId || CURRENT_CUSTOMER,
      }),
    'admin.orgunits.list',
  )
  return response.data
}

/**
 * Retrieves the customer ID for the authenticated user.
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<object>} A promise that resolves to the customer object containing the ID
 * @throws {Error} If the API call fails
 */
export async function getCustomerId(authToken, apiOptions = {}) {
  const service = await createApiClient(
    google.admin,
    API_VERSIONS.ADMIN_DIRECTORY,
    [SCOPES.ADMIN_DIRECTORY_CUSTOMER_READONLY],
    authToken,
    apiOptions,
  )

  const requestParams = { customerKey: CURRENT_CUSTOMER }

  try {
    const response = await callWithRetry(() => service.customers.get(requestParams), 'admin.customers.get')
    return response.data
  } catch (error) {
    logger.error(`${TAGS.API} admin_sdk.getCustomerId Error: ${error.message}`, error)
    throw error
  }
}
