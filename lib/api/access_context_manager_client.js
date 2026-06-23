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
 * @file Access Context Manager API client wrapper using googleapis.
 */

import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * Access Context Manager API client wrapper.
 */
export class AccessContextManagerClient {
  /**
   * Initializes the client with API options.
   * @param {object} apiOptions Options to pass to the API client.
   */
  constructor(apiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Gets an instance of the Access Context Manager service.
   * @param {string} authToken The OAuth 2.0 auth token.
   * @returns {Promise<object>} The ACM service instance.
   */
  async getClient(authToken) {
    return createApiClient(
      google.accesscontextmanager,
      API_VERSIONS.ACCESS_CONTEXT_MANAGER,
      [SCOPES.CLOUD_PLATFORM],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Creates an Access Policy.
   * @param {object} policy The Access Policy resource to create.
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<object>} The Operation object representing the long-running operation.
   * @throws {Error} If the API call fails.
   */
  async createAccessPolicy(policy, authToken) {
    logger.debug(`${TAGS.API} createAccessPolicy called with policy:`, policy)
    const client = await this.getClient(authToken)
    try {
      const response = await callWithRetry(
        () =>
          client.accessPolicies.create({
            requestBody: policy,
          }),
        'accessPolicies.create',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'creating access policy')
    }
  }

  /**
   * Lists Access Policies.
   * @param {object} options Parameters for the list call.
   * @param {string} options.parent Required. Resource name of the parent organization. Format: `organizations/{organization_id}`.
   * @param {number} [options.pageSize] Optional page size.
   * @param {string} [options.pageToken] Optional page token.
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<object>} The response containing access policies.
   * @throws {Error} If the API call fails.
   */
  async listAccessPolicies(options = {}, authToken) {
    logger.debug(`${TAGS.API} listAccessPolicies called with options:`, options)
    if (!options.parent) {
      throw new Error('Missing required parameter: options.parent')
    }
    const client = await this.getClient(authToken)
    try {
      const response = await callWithRetry(
        () =>
          client.accessPolicies.list({
            parent: options.parent,
            pageSize: options.pageSize,
            pageToken: options.pageToken,
          }),
        'accessPolicies.list',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'listing access policies')
    }
  }

  /**
   * Creates an Access Level in a policy.
   * @param {string} policyName Required. Resource name of the parent Access Policy. Format: `accessPolicies/{policy_id}`.
   * @param {object} accessLevel The Access Level resource to create.
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<object>} The Operation object representing the long-running operation.
   * @throws {Error} If the API call fails.
   */
  async createAccessLevel(policyName, accessLevel, authToken) {
    logger.debug(`${TAGS.API} createAccessLevel called for policy: ${policyName} with level:`, accessLevel)
    if (!policyName) {
      throw new Error('Missing required parameter: policyName')
    }
    const client = await this.getClient(authToken)
    try {
      const response = await callWithRetry(
        () =>
          client.accessPolicies.accessLevels.create({
            parent: policyName,
            requestBody: accessLevel,
          }),
        'accessPolicies.accessLevels.create',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'creating access level')
    }
  }

  /**
   * Lists Access Levels in a policy.
   * @param {string} policyName Required. Resource name of the parent Access Policy. Format: `accessPolicies/{policy_id}`.
   * @param {object} [options] Optional parameters.
   * @param {number} [options.pageSize] Optional page size.
   * @param {string} [options.pageToken] Optional page token.
   * @param {string} [options.accessLevelFormat] Optional format (e.g. 'AS_DEFINED', 'CEL').
   * @param {string} [authToken] Optional OAuth 2.0 access token.
   * @returns {Promise<object>} The response containing access levels.
   * @throws {Error} If the API call fails.
   */
  async listAccessLevels(policyName, options = {}, authToken) {
    logger.debug(`${TAGS.API} listAccessLevels called for policy: ${policyName} with options:`, options)
    if (!policyName) {
      throw new Error('Missing required parameter: policyName')
    }
    const client = await this.getClient(authToken)
    try {
      const response = await callWithRetry(
        () =>
          client.accessPolicies.accessLevels.list({
            parent: policyName,
            pageSize: options.pageSize,
            pageToken: options.pageToken,
            accessLevelFormat: options.accessLevelFormat,
          }),
        'accessPolicies.accessLevels.list',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'listing access levels')
    }
  }
}
