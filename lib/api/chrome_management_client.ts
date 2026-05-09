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

import { google, chromemanagement_v1 } from 'googleapis'
import { createApiClient, ApiOptions } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * Chrome Management API client wrapper using googleapis.
 */
export class ChromeManagementClient {
  private apiOptions: ApiOptions

  /**
   * Initializes the client with API options.
   * @param apiOptions Options to pass to the API client.
   */
  constructor(apiOptions: ApiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Gets an instance of the Chrome Management service.
   * @param authToken Optional OAuth 2.0 access token.
   * @returns The Chrome Management service instance.
   */
  async getClient(authToken?: string): Promise<chromemanagement_v1.Chromemanagement> {
    return createApiClient<chromemanagement_v1.Chromemanagement>(
      options => google.chromemanagement({ ...options, version: 'v1' }),
      API_VERSIONS.CHROME_MANAGEMENT,
      [SCOPES.CHROME_MANAGEMENT_REPORTS_READONLY, SCOPES.CHROME_MANAGEMENT_PROFILES_READONLY],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Counts Chrome browser versions for a specific customer.
   * @param customerId The customer ID.
   * @param orgUnitId Optional organizational unit ID.
   * @param authToken Optional OAuth 2.0 access token.
   * @returns An array of browser version counts.
   * @throws {Error} If customerId is missing or the API call fails.
   */
  async countBrowserVersions(
    customerId: string,
    orgUnitId?: string,
    authToken?: string,
  ): Promise<chromemanagement_v1.Schema$GoogleChromeManagementV1BrowserVersion[] | undefined> {
    logger.debug(`${TAGS.API} countBrowserVersions called with customerId: ${customerId}, orgUnitId: ${orgUnitId}`)
    if (!customerId) {
      throw new Error('customerId is required for countBrowserVersions')
    }
    const client = await this.getClient(authToken)
    try {
      const request: { customer: string; orgUnitId?: string } = { customer: `customers/${customerId}` }
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
   * @param customerId The customer ID.
   * @param authToken Optional OAuth 2.0 access token.
   * @returns An array of customer profiles.
   * @throws {Error} If customerId is missing or the API call fails.
   */
  async listCustomerProfiles(
    customerId: string,
    authToken?: string,
  ): Promise<chromemanagement_v1.Schema$GoogleChromeManagementVersionsV1ChromeBrowserProfile[] | undefined> {
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
}
