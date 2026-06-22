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
 * @file Cloud Resource Manager API client wrapper using googleapis.
 */

import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * Cloud Resource Manager API client wrapper.
 */
export class CloudResourceManagerClient {
  /**
   * Initializes the client with API options.
   * @param {object} apiOptions Options to pass to the API client.
   */
  constructor(apiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Gets an instance of the Cloud Resource Manager service.
   * @param {string} authToken The OAuth 2.0 auth token.
   * @returns {Promise<object>} The CRM service instance.
   */
  async getClient(authToken) {
    return createApiClient(
      google.cloudresourcemanager,
      API_VERSIONS.CLOUD_RESOURCE_MANAGER,
      [SCOPES.CLOUD_PLATFORM],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Searches for organizations matching the specified query or filter.
   * @param {object} [options] Optional parameters.
   * @param {string} [options.filter] An organizational filter (v1 API standard).
   * @param {string} [options.query] Legacy alias for filter.
   * @param {number} [options.pageSize] Optional page size.
   * @param {string} [options.pageToken] Optional page token.
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<object>} The search response containing organizations.
   * @throws {Error} If the API call fails.
   */
  async searchOrganizations(options = {}, authToken) {
    logger.debug(`${TAGS.API} searchOrganizations called with options:`, options)
    const { query, filter, ...rest } = options
    const requestBody = {
      filter: filter || query,
      ...rest,
    }
    const client = await this.getClient(authToken)
    try {
      const response = await callWithRetry(
        () =>
          client.organizations.search({
            requestBody,
          }),
        'organizations.search',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'searching organizations')
    }
  }
}
