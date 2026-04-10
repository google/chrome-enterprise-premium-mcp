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
 * @file Fake implementation of the ServiceUsageClient interface for testing.
 */
import axios from 'axios'
import { ServiceUsageClient } from './interfaces/service_usage_client.js'
import { TAGS } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * Fake implementation of the ServiceUsageClient interface for testing.
 */
export class FakeServiceUsageClient extends ServiceUsageClient {
  /**
   * Initializes the fake services map.
   * @param {string} [rootUrl] The root URL for the fake server.
   */
  constructor(rootUrl) {
    super()
    this.rootUrl = rootUrl
    // Fallback in-memory state for unit tests that don't use a fake server
    this.services = {
      'admin.googleapis.com': 'DISABLED',
      'chromemanagement.googleapis.com': 'DISABLED',
      'chromepolicy.googleapis.com': 'DISABLED',
      'cloudidentity.googleapis.com': 'DISABLED',
      'licensing.googleapis.com': 'DISABLED',
      'serviceusage.googleapis.com': 'DISABLED',
    }
  }

  /**
   * Checks a service's enabled/disabled status.
   * Calls the fake server if rootUrl is provided, otherwise uses in-memory state.
   * @param {string} projectId The project ID or number.
   * @param {string} serviceName The name of the service (e.g., 'admin.googleapis.com').
   * @param {string} _authToken The OAuth 2.0 auth token.
   * @returns {Promise<object>} The service status.
   */
  async getServiceStatus(projectId, serviceName, _authToken) {
    if (this.rootUrl) {
      const url = new URL(`/v1/projects/${projectId}/services/${serviceName}`, this.rootUrl).href
      logger.debug(`${TAGS.API} [FAKE] GET ${url}`)
      const response = await axios.get(url)
      return response.data
    }

    return {
      name: `projects/${projectId}/services/${serviceName}`,
      state: this.services[serviceName] || 'DISABLED',
    }
  }

  /**
   * Enables a service.
   * Calls the fake server if rootUrl is provided, otherwise updates in-memory state.
   * @param {string} projectId The project ID or number.
   * @param {string} serviceName The name of the service to enable.
   * @param {string} _authToken The OAuth 2.0 auth token.
   * @returns {Promise<object>} The operation result.
   */
  async enableService(projectId, serviceName, _authToken) {
    if (this.rootUrl) {
      const url = new URL(`/v1/projects/${projectId}/services/${serviceName}:enable`, this.rootUrl).href
      logger.debug(`${TAGS.API} [FAKE] POST ${url}`)
      const response = await axios.post(url)
      return response.data
    }

    this.services[serviceName] = 'ENABLED'
    return {
      done: true,
      response: {
        state: 'ENABLED',
      },
    }
  }
}
