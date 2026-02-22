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
 * @fileoverview Real implementation of the AdminSdkClient interface using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry } from '../util/helpers.js'
import { API_VERSIONS, SCOPES, TAGS } from '../constants.js'
import { AdminSdkClient } from './interfaces/admin_sdk_client.js'
import { logger } from '../util/logger.js'

const CURRENT_CUSTOMER = 'my_customer'

export class RealAdminSdkClient extends AdminSdkClient {
  constructor(apiOptions = {}) {
    super()
    this.apiOptions = apiOptions
  }

  async getAdminService(version, scopes, authToken) {
    return createApiClient(google.admin, version, scopes, authToken, this.apiOptions)
  }

  async getCustomerId(authToken) {
    logger.debug(`${TAGS.API} getCustomerId called`)
    const service = await this.getAdminService(
      API_VERSIONS.ADMIN_DIRECTORY,
      [SCOPES.ADMIN_DIRECTORY_CUSTOMER_READONLY],
      authToken,
    )
    try {
      const response = await callWithRetry(
        () => service.customers.get({ customerKey: CURRENT_CUSTOMER }),
        'admin.customers.get',
      )
      return response.data
    } catch (error) {
      logger.error(`${TAGS.API} getCustomerId Error: ${error.message}`, error)
      throw error
    }
  }

  async listOrgUnits(options, authToken) {
    logger.debug(`${TAGS.API} listOrgUnits called with options: ${JSON.stringify(options)}`)
    const service = await this.getAdminService(
      API_VERSIONS.ADMIN_DIRECTORY,
      [SCOPES.ADMIN_DIRECTORY_ORGUNIT_READONLY],
      authToken,
    )
    const response = await callWithRetry(
      () =>
        service.orgunits.list({
          customerId: options.customerId || CURRENT_CUSTOMER,
          type: 'ALL',
        }),
      'admin.orgunits.list',
    )
    return response.data
  }

  async listChromeActivities(options, authToken) {
    logger.debug(`${TAGS.API} listChromeActivities called with options: ${JSON.stringify(options)}`)
    const service = await this.getAdminService(
      API_VERSIONS.ADMIN_REPORTS,
      [SCOPES.ADMIN_REPORTS_AUDIT_READONLY],
      authToken,
    )
    const response = await callWithRetry(
      () =>
        service.activities.list({
          userKey: options.userKey || 'all',
          applicationName: 'chrome',
          eventName: options.eventName,
          startTime: options.startTime,
          endTime: options.endTime,
          maxResults: options.maxResults,
          customerId: options.customerId || CURRENT_CUSTOMER,
        }),
      'admin.activities.list',
    )
    return response.data.items
  }
}
