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
 * @file Google Chrome Management API client wrapper.
 *
 * Provides functions to:
 * - Count Chrome browser versions.
 * - List customer profiles.
 */

import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * Initializes or returns the cached Chrome Management API client.
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<object>} The Chrome Management API client instance
 */
async function getManagementClient(authToken, apiOptions) {
  return createApiClient(
    google.chromemanagement,
    API_VERSIONS.CHROME_MANAGEMENT,
    [SCOPES.CHROME_MANAGEMENT_REPORTS_READONLY, SCOPES.CHROME_MANAGEMENT_PROFILES_READONLY],
    authToken,
    apiOptions,
  )
}

/**
 * Counts Chrome browser versions for a specific customer.
 * @param {string} customerId - The Google Workspace Customer ID (e.g. C012345)
 * @param {string} [orgUnitId] - The Organizational Unit ID to filter results
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<Array<object>>} A list of browser version counts
 * @throws {Error} If the API call fails
 */
export async function countBrowserVersions(customerId, orgUnitId, apiOptions = {}) {
  if (!customerId) {
    throw new Error('customerId is required for countBrowserVersions')
  }

  // TODO: Pass in authToken here.
  const client = await getManagementClient(null, apiOptions)

  try {
    const message = `Counting browser versions for customer ${customerId}...`
    logger.info(`${TAGS.API} ${message}`)

    const request = {
      customer: `customers/${customerId}`,
    }

    if (orgUnitId) {
      request.orgUnitId = orgUnitId
    }

    const response = await callWithRetry(
      () => client.customers.reports.countChromeVersions(request),
      'reports.countChromeVersions',
    )

    return response.data.browserVersions
  } catch (error) {
    logger.error(`${TAGS.API} Error counting browser versions:`, error)
    throw error
  }
}

/**
 * Lists Chrome browser profiles for a specific customer.
 * @param {string} customerId - The Google Workspace Customer ID (e.g. C012345)
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<Array<object>>} A list of customer profiles
 * @throws {Error} If the API call fails
 */
export async function listCustomerProfiles(customerId, apiOptions = {}) {
  if (!customerId) {
    throw new Error('customerId is required for listCustomerProfiles')
  }

  const client = await getManagementClient(null, apiOptions)

  try {
    const message = `Listing customer profiles for customer ${customerId}...`
    logger.info(`${TAGS.API} ${message}`)

    const request = {
      parent: `customers/${customerId}`,
    }

    const response = await callWithRetry(() => client.customers.profiles.list(request), 'profiles.list')

    return response.data.chromeBrowserProfiles
  } catch (error) {
    logger.error(`${TAGS.API} Error listing customer profiles:`, error)
    throw error
  }
}
