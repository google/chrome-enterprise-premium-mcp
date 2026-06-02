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
 * @file Chrome Management API client wrapper using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * Chrome Management API client wrapper using googleapis.
 */
export class ChromeManagementClient {
  /**
   * Initializes the client with API options.
   * @param {object} apiOptions Options to pass to the API client.
   */
  constructor(apiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Gets an instance of the Chrome Management service.
   * @param {string} authToken The OAuth 2.0 auth token.
   * @returns {Promise<object>} The Chrome Management service instance.
   */
  async getClient(authToken) {
    return createApiClient(
      google.chromemanagement,
      API_VERSIONS.CHROME_MANAGEMENT,
      [
        SCOPES.CHROME_MANAGEMENT_REPORTS_READONLY,
        SCOPES.CHROME_MANAGEMENT_PROFILES_READONLY,
        SCOPES.CHROME_MANAGEMENT_POLICY,
        SCOPES.CHROME_MANAGEMENT_SECURITYINSIGHTS,
      ],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Counts Chrome browser versions for a specific customer.
   * @param {string} customerId The customer ID.
   * @param {string} [orgUnitId] Optional organizational unit ID.
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<Array<object>>} An array of browser version counts.
   * @throws {Error} If customerId is missing or the API call fails.
   */
  async countBrowserVersions(customerId, orgUnitId, authToken) {
    logger.debug(`${TAGS.API} countBrowserVersions called with customerId: ${customerId}, orgUnitId: ${orgUnitId}`)
    if (!customerId) {
      throw new Error('customerId is required for countBrowserVersions')
    }
    const client = await this.getClient(authToken)
    try {
      const request = { customer: `customers/${customerId}` }
      if (orgUnitId) {
        request.orgUnitId = orgUnitId
      }
      const response = await callWithRetry(
        () => client.customers.reports.countChromeVersions(request),
        'reports.countChromeVersions',
      )
      return response.data.browserVersions
    } catch (error) {
      handleApiError(error, TAGS.API, 'counting browser versions')
    }
  }

  /**
   * Lists Chrome browser profiles for a specific customer.
   * @param {string} customerId The customer ID.
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<Array<object>>} An array of customer profiles.
   * @throws {Error} If customerId is missing or the API call fails.
   */
  async listCustomerProfiles(customerId, authToken) {
    logger.debug(`${TAGS.API} listCustomerProfiles called with customerId: ${customerId}`)
    if (!customerId) {
      throw new Error('customerId is required for listCustomerProfiles')
    }
    const client = await this.getClient(authToken)
    try {
      const request = { parent: `customers/${customerId}` }
      const response = await callWithRetry(() => client.customers.profiles.list(request), 'profiles.list')
      return response.data.chromeBrowserProfiles
    } catch (error) {
      handleApiError(error, TAGS.API, 'listing customer profiles')
    }
  }

  /**
   * Enables security insights for a specific customer.
   * @param {string} customerId The customer ID.
   * @param {string[]} [targetOus] Optional list of organizational unit IDs to target.
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<object>} The security insights status.
   * @throws {Error} If customerId is missing or the API call fails.
   */
  async enableSecurityInsights(customerId, targetOus, authToken) {
    logger.debug(`${TAGS.API} enableSecurityInsights called with customerId: ${customerId}, targetOus: ${targetOus}`)
    if (!customerId) {
      throw new Error('customerId is required for enableSecurityInsights')
    }
    const client = await this.getClient(authToken)
    try {
      const name = `customers/${customerId}/enterprise/securityInsights`
      const request = { name }
      if (targetOus && targetOus.length > 0) {
        request.requestBody = { targetOus }
      }
      const response = await callWithRetry(
        () => client.customers.enterprise.securityInsights.enable(request),
        'customers.enterprise.securityInsights.enable',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'enabling security insights')
    }
  }
}
