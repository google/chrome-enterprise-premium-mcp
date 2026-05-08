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
 * @file Service-enablement client.
 *
 * Uses Service Management's `services.list?consumerId=project:X` for the
 * enablement read (accepts the `service.management` scope) and Service
 * Usage's `services.enable` for the write (also accepts `service.management`).
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { API_VERSIONS, SCOPES, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * Service-enablement client backed by Service Management (read) and Service Usage (write).
 */
export class ServiceUsageClient {
  /**
   * Initializes the client.
   * @param {object} [apiOptions] Configuration options for the API client.
   */
  constructor(apiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Returns an authenticated Service Management API client.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The Service Management API client.
   */
  async getServiceManagementService(authToken) {
    return createApiClient(
      google.servicemanagement,
      API_VERSIONS.SERVICE_MANAGEMENT,
      [SCOPES.SERVICE_USAGE],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Returns an authenticated Service Usage API client.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<{client: object, source: string}>} The Service Usage API context.
   */
  async getServiceUsageService(authToken) {
    return createApiClient(
      google.serviceusage,
      API_VERSIONS.SERVICE_USAGE,
      [SCOPES.SERVICE_USAGE],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Lists every Google API enabled by the given consumer project.
   * @param {string} projectId The Google Cloud project ID.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<Set<string>>} Set of enabled service names.
   */
  async listEnabledServices(projectId, authToken) {
    logger.debug(`${TAGS.API} listEnabledServices called for project ${projectId}`)
    const { client: service, source } = await this.getServiceManagementService(authToken)
    const enabled = new Set()
    let pageToken
    try {
      do {
        const response = await callWithRetry(
          () =>
            service.services.list({
              consumerId: `project:${projectId}`,
              pageSize: 500,
              ...(pageToken ? { pageToken } : {}),
            }),
          'servicemanagement.services.list',
        )
        for (const svc of response.data.services || []) {
          enabled.add(svc.serviceName)
        }
        pageToken = response.data.nextPageToken
      } while (pageToken)
      return enabled
    } catch (error) {
      handleApiError(error, TAGS.API, `listing enabled services for project ${projectId}`, source)
    }
  }

  /**
   * Enables a service in the given consumer project.
   * @param {string} projectId The Google Cloud project ID.
   * @param {string} serviceName The service to enable.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The long-running-operation result.
   */
  async enableService(projectId, serviceName, authToken) {
    logger.debug(`${TAGS.API} enableService called for ${serviceName} in project ${projectId}`)
    const { client: service, source } = await this.getServiceUsageService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.services.enable({
            name: `projects/${projectId}/services/${serviceName}`,
          }),
        'serviceusage.services.enable',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `enabling ${serviceName}`, source)
    }
  }
}
