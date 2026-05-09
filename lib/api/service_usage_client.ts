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
 * @file Service Usage API client wrapper using googleapis.
 */

import { google, serviceusage_v1 } from 'googleapis'
import { createApiClient, ApiOptions } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { API_VERSIONS, SCOPES, TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * Service Usage API client wrapper using googleapis.
 */
export class ServiceUsageClient {
  private apiOptions: ApiOptions

  /**
   * Initializes the ServiceUsageClient.
   * @param apiOptions Configuration options for the API client.
   */
  constructor(apiOptions: ApiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Gets an authenticated Service Usage API client.
   * @param authToken Optional authentication token.
   * @returns The Service Usage API client.
   */
  async getServiceUsageService(authToken?: string): Promise<serviceusage_v1.Serviceusage> {
    return createApiClient<serviceusage_v1.Serviceusage>(
      options => google.serviceusage({ ...options, version: 'v1' }),
      API_VERSIONS.SERVICE_USAGE,
      [SCOPES.SERVICE_USAGE, SCOPES.SERVICE_USAGE_READONLY, SCOPES.CLOUD_PLATFORM],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Gets the status of a specific service in a project.
   * @param projectId The ID of the Google Cloud project.
   * @param serviceName The name of the service to check.
   * @param authToken Optional authentication token.
   * @returns The service status data.
   */
  async getServiceStatus(
    projectId: string,
    serviceName: string,
    authToken?: string,
  ): Promise<serviceusage_v1.Schema$GoogleApiServiceusageV1Service> {
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
   * @param projectId The ID of the Google Cloud project.
   * @param serviceName The name of the service to enable.
   * @param authToken Optional authentication token.
   * @returns The API response data (LRO).
   */
  async enableService(
    projectId: string,
    serviceName: string,
    authToken?: string,
  ): Promise<serviceusage_v1.Schema$Operation> {
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
