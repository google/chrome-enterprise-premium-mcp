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
 * @file Compute Engine API client wrapper using googleapis.
 */

import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * Compute Engine API client wrapper.
 */
export class ComputeClient {
  /**
   * Initializes the client with API options.
   * @param {object} apiOptions Options to pass to the API client.
   */
  constructor(apiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Gets an instance of the Compute service.
   * @param {string} authToken The OAuth 2.0 auth token.
   * @returns {Promise<object>} The Compute service instance.
   */
  async getClient(authToken) {
    return createApiClient(google.compute, API_VERSIONS.COMPUTE, [SCOPES.CLOUD_PLATFORM], authToken, this.apiOptions)
  }

  /**
   * Lists firewall rules in a specified project.
   * @param {string} project The project ID.
   * @param {object} [options] Optional parameters for filtering/pagination.
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<object>} The firewall rules list response.
   * @throws {Error} If the API call fails.
   */
  async listFirewalls(project, options = {}, authToken) {
    logger.debug(`${TAGS.API} listFirewalls called for project: ${project}`)
    const client = await this.getClient(authToken)
    try {
      const response = await callWithRetry(
        () =>
          client.firewalls.list({
            project,
            ...options,
          }),
        'firewalls.list',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'listing firewall rules')
    }
  }
}
