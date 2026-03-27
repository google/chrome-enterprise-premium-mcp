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
 * @fileoverview Real implementation of the ServiceUsageClient interface using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { API_VERSIONS, SCOPES, TAGS } from '../constants.js'
import { ServiceUsageClient } from './interfaces/service_usage_client.js'
import { logger } from '../util/logger.js'

export class RealServiceUsageClient extends ServiceUsageClient {
  constructor(apiOptions = {}) {
    super()
    this.apiOptions = apiOptions
  }

  async getServiceUsageService(authToken) {
    return createApiClient(
      google.serviceusage,
      API_VERSIONS.SERVICE_USAGE,
      [SCOPES.SERVICE_USAGE, SCOPES.SERVICE_USAGE_READONLY, SCOPES.CLOUD_PLATFORM],
      authToken,
      this.apiOptions,
    )
  }

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
