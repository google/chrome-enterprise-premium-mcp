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
 * @file Fake implementation of the ChromeManagementClient interface for testing.
 */
import axios from 'axios'
import { ChromeManagementClient } from './interfaces/chrome_management_client.js'
import { TAGS } from '../constants.js'
import { URL } from 'url'
import { logger } from '../util/logger.js'

/**
 * Fake implementation of the ChromeManagementClient for testing purposes.
 * Simulates API calls to Chrome Management services.
 */
export class FakeChromeManagementClient extends ChromeManagementClient {
  /**
   * Initializes the fake client with a root URL for the mock server.
   * @param {string} rootUrl The base URL of the mock management service.
   */
  constructor(rootUrl) {
    super()
    this.rootUrl = rootUrl
  }

  /**
   * Counts Chrome browser versions for a specific customer and organizational unit.
   * @param {string} customerId The unique identifier for the customer.
   * @param {string} orgUnitId The organizational unit ID to filter results.
   * @returns {Promise<object>} A promise that resolves to the browser version counts.
   */
  async countBrowserVersions(customerId, orgUnitId) {
    const url = new URL(`/v1/customers/${customerId}/reports:countChromeVersions`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] GET ${url}`)
    const params = orgUnitId ? { orgUnitId } : {}
    const response = await axios.get(url, { params })
    return response.data.browserVersions
  }

  /**
   * Lists Chrome browser profiles for a specific customer.
   * @param {string} customerId The unique identifier for the customer.
   * @returns {Promise<object[]>} A promise that resolves to an array of browser profiles.
   */
  async listCustomerProfiles(customerId) {
    const url = new URL(`/v1/customers/${customerId}/profiles`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] GET ${url}`)
    const response = await axios.get(url)
    return response.data.chromeBrowserProfiles
  }
}
