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
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { API_VERSIONS, SCOPES, TAGS, CEP_CONSTANTS, SERVICE_NAMES } from '../constants.js'
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

  async getLicensingService(version, scopes, authToken) {
    return createApiClient(google.licensing, version, scopes, authToken, this.apiOptions)
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
      handleApiError(error, TAGS.API, 'retrieving customer ID')
    }
  }

  async listOrgUnits(options, authToken) {
    logger.debug(`${TAGS.API} listOrgUnits called with options: ${JSON.stringify(options)}`)
    const service = await this.getAdminService(
      API_VERSIONS.ADMIN_DIRECTORY,
      [SCOPES.ADMIN_DIRECTORY_ORGUNIT_READONLY],
      authToken,
    )
    try {
      const response = await callWithRetry(
        () =>
          service.orgunits.list({
            customerId: options.customerId || CURRENT_CUSTOMER,
            type: 'ALL_INCLUDING_PARENT',
          }),
        'admin.orgunits.list',
      )
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'listing organizational units')
    }
  }

  async listChromeActivities(options, authToken) {
    logger.debug(`${TAGS.API} listChromeActivities called with options: ${JSON.stringify(options)}`)
    const service = await this.getAdminService(
      API_VERSIONS.ADMIN_REPORTS,
      [SCOPES.ADMIN_REPORTS_AUDIT_READONLY],
      authToken,
    )
    try {
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
    } catch (error) {
      handleApiError(error, TAGS.API, 'listing Chrome activity logs')
    }
  }

  async checkCepSubscription(customerId, authToken) {
    logger.debug(`${TAGS.API} checkCepSubscription called`)

    // The Licensing API rejects 'my_customer' with a misleading 403 error.
    // We must resolve it to the actual customer ID first.
    const initialCustomerId = customerId || CURRENT_CUSTOMER
    const resolvedCustomerId =
      initialCustomerId === CURRENT_CUSTOMER ? (await this.getCustomerId(authToken)).id : initialCustomerId

    const service = await this.getLicensingService(API_VERSIONS.LICENSING, [SCOPES.LICENSING], authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.licenseAssignments.listForProductAndSku({
            productId: CEP_CONSTANTS.PRODUCT_ID,
            skuId: CEP_CONSTANTS.SKU_ID,
            customerId: resolvedCustomerId,
          }),
        'licensing.licenseAssignments.listForProductAndSku',
      )
      return response.data
    } catch (error) {
      if (error.response?.status === 403) {
        const message = error.response.data?.error?.message || ''
        if (message.includes(SERVICE_NAMES.LICENSING)) {
          throw new Error(
            `API [${SERVICE_NAMES.LICENSING}] is not enabled. Please enable it at https://console.cloud.google.com/apis/library/${SERVICE_NAMES.LICENSING}`,
          )
        }
        throw new Error(
          `Access denied to Licensing API. The account may not have permission to access licensing information.`,
        )
      }
      handleApiError(error, TAGS.API, 'checking CEP subscription')
    }
  }

  async checkUserCepLicense(userId, authToken) {
    logger.debug(`${TAGS.API} checkUserCepLicense called for user: ${userId}`)
    const service = await this.getLicensingService(API_VERSIONS.LICENSING, [SCOPES.LICENSING], authToken)
    try {
      const response = await callWithRetry(
        () =>
          service.licenseAssignments.get({
            productId: CEP_CONSTANTS.PRODUCT_ID,
            skuId: CEP_CONSTANTS.SKU_ID,
            userId: userId,
          }),
        'licensing.licenseAssignments.get',
      )
      return response.data
    } catch (error) {
      if (error.response?.status === 404) {
        return null
      }
      if (error.response?.status === 403) {
        const message = error.response.data?.error?.message || ''
        if (message.includes(SERVICE_NAMES.LICENSING)) {
          throw new Error(
            `API [${SERVICE_NAMES.LICENSING}] is not enabled. Please enable it at https://console.cloud.google.com/apis/library/${SERVICE_NAMES.LICENSING}`,
          )
        }
        throw new Error(
          `Access denied to Licensing API. The account may not have permission to access licensing information.`,
        )
      }
      handleApiError(error, TAGS.API, `checking license for user ${userId}`)
    }
  }
}
