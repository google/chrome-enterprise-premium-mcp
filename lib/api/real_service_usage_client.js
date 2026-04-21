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
 * @file Real implementation of the ServiceUsageClient interface using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { API_VERSIONS, SCOPES, TAGS } from '../constants.js'
import { ServiceUsageClient } from './interfaces/service_usage_client.js'
import { logger } from '../util/logger.js'

/**
 * Real implementation of the ServiceUsageClient interface.
 */
export class RealServiceUsageClient extends ServiceUsageClient {
  /**
   * Initializes the RealServiceUsageClient.
   * @param {object} [apiOptions] Configuration options for the API client.
   */
  constructor(apiOptions = {}) {
    super()
    this.apiOptions = apiOptions
  }

  /**
   * Gets an authenticated Service Usage API client.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The Service Usage API client.
   */
  async getServiceUsageService(authToken) {
    return createApiClient(
      google.serviceusage,
      API_VERSIONS.SERVICE_USAGE,
      [SCOPES.SERVICE_USAGE, SCOPES.SERVICE_USAGE_READONLY, SCOPES.CLOUD_PLATFORM],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Gets the status of a specific service in a project.
   * @param {string} projectId The ID of the Google Cloud project.
   * @param {string} serviceName The name of the service to check.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The service status data.
   */
  async getServiceStatus(projectId, serviceName, authToken) {
    logger.debug(`${TAGS.API} getServiceStatus called for ${serviceName} in project ${projectId}`)
    const service = await this.getServiceUsageService(authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.services.get({
            name: `projects/${projectId}/services/${serviceName}`,
          }),
        'serviceusage.services.get',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `getting status for ${serviceName}`)
    }
  }

  /**
   * Enables a specific service in a project.
   * @param {string} projectId The ID of the Google Cloud project.
   * @param {string} serviceName The name of the service to enable.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The API response data (LRO).
   */
  async enableService(projectId, serviceName, authToken) {
    logger.debug(`${TAGS.API} enableService called for ${serviceName} in project ${projectId}`)
    const service = await this.getServiceUsageService(authToken)
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
      handleApiError(error, TAGS.API, `enabling ${serviceName}`)
    }
  }
}
