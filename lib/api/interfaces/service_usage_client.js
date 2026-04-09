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
 * @interface ServiceUsageClient
 */
export class ServiceUsageClient {
  /**
   * Gets the status of a service.
   * @param {string} projectId The project ID or number.
   * @param {string} serviceName The name of the service (e.g., 'admin.googleapis.com').
   * @param {string} authToken The OAuth 2.0 auth token.
   * @returns {Promise<object>} The service status.
   */
  async getServiceStatus(_projectId, _serviceName, _authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Enables a service.
   * @param {string} projectId The project ID or number.
   * @param {string} serviceName The name of the service to enable.
   * @param {string} authToken The OAuth 2.0 auth token.
   * @returns {Promise<object>} The operation result.
   */
  async enableService(_projectId, _serviceName, _authToken) {
    throw new Error('Not implemented')
  }
}
