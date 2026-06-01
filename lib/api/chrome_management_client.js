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
   * Resolves 'my_customer' to the actual obfuscated customer ID if needed.
   * @param {string} customerId The customer ID or 'my_customer'.
   * @param {string} authToken The OAuth 2.0 auth token.
   * @returns {Promise<string>} The resolved customer ID.
   */
  async resolveCustomerId(customerId, authToken) {
    if (customerId && customerId !== 'my_customer') {
      return customerId
    }
    const adminClient = await createApiClient(
      google.admin,
      'directory_v1',
      ['https://www.googleapis.com/auth/admin.directory.customer.readonly'],
      authToken,
      this.apiOptions,
    )
    const response = await callWithRetry(
      () => adminClient.customers.get({ customerKey: 'my_customer' }),
      'admin.customers.get',
    )
    return response.data.id
  }

  /**
   * Constructs the Security Insights API URL using the configured rootUrl if present.
   * @param {string} resolvedId The resolved customer ID.
   * @param {string} action The action suffix (e.g., 'checkEnablementStatus', 'enable', 'disable').
   * @returns {string} The full endpoint URL.
   * @private
   */
  _getSecurityInsightsUrl(resolvedId, action) {
    const baseUrl = this.apiOptions.rootUrl || 'https://chromemanagement.googleapis.com/'
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    return `${cleanBase}v1/customers/${resolvedId}/enterprise/securityInsights:${action}`
  }

  /**
   * Gets the setting state of the Security Insights feature for the customer.
   * @param {string} customerId The customer ID or 'my_customer'.
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<object>} The enablement status response.
   */
  async checkSecurityInsightsStatus(customerId, authToken) {
    logger.debug(`${TAGS.API} checkSecurityInsightsStatus called for customerId: ${customerId}`)
    const resolvedId = await this.resolveCustomerId(customerId, authToken)
    const client = await this.getClient(authToken)
    try {
      const url = this._getSecurityInsightsUrl(resolvedId, 'checkEnablementStatus')
      const response = await callWithRetry(
        () => client.context._options.auth.request({ url, method: 'GET' }),
        'enterprise.securityInsights.checkEnablementStatus',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'checking security insights status')
    }
  }

  /**
   * Enables Security Insights for the customer and sets up required Chrome connectors.
   * @param {string} customerId The customer ID or 'my_customer'.
   * @param {string[]} [targetOus] Optional Organizational Units relative to root (e.g. ["/corp"]).
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<object>} The enablement response.
   */
  async enableSecurityInsights(customerId, targetOus, authToken) {
    logger.debug(`${TAGS.API} enableSecurityInsights called for customerId: ${customerId}`)
    const resolvedId = await this.resolveCustomerId(customerId, authToken)
    const client = await this.getClient(authToken)
    try {
      const url = this._getSecurityInsightsUrl(resolvedId, 'enable')
      const body = {}
      if (targetOus && targetOus.length > 0) {
        body.targetOus = targetOus
      }
      const response = await callWithRetry(
        () => client.context._options.auth.request({ url, method: 'POST', data: body }),
        'enterprise.securityInsights.enable',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'enabling security insights')
    }
  }

  /**
   * Disables Security Insights for the customer.
   * @param {string} customerId The customer ID or 'my_customer'.
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<object>} The disable response.
   */
  async disableSecurityInsights(customerId, authToken) {
    logger.debug(`${TAGS.API} disableSecurityInsights called for customerId: ${customerId}`)
    const resolvedId = await this.resolveCustomerId(customerId, authToken)
    const client = await this.getClient(authToken)
    try {
      const url = this._getSecurityInsightsUrl(resolvedId, 'disable')
      const response = await callWithRetry(
        () => client.context._options.auth.request({ url, method: 'POST', data: {} }),
        'enterprise.securityInsights.disable',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'disabling security insights')
    }
  }
}
