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
 * @file Admin SDK API client wrapper using googleapis.
 */

import { google, admin_directory_v1, admin_reports_v1, licensing_v1 } from 'googleapis'
import { createApiClient, ApiOptions } from '../util/api-client.js'
import { callWithRetry, handleApiError, isApiError } from '../util/helpers.js'
import { API_VERSIONS, SCOPES, TAGS, CEP_CONSTANTS, SERVICE_NAMES, CURRENT_CUSTOMER } from '../constants.js'
import { logger } from '../util/logger.js'

/**
 * Admin SDK API client wrapper using googleapis.
 */
export class AdminSdkClient {
  private apiOptions: ApiOptions

  /**
   * Initializes the client with API options.
   * @param apiOptions Options to pass to the API client.
   */
  constructor(apiOptions: ApiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Gets an instance of the Admin Directory service.
   * @param version The API version to use.
   * @param scopes The scopes to request.
   * @param authToken The OAuth 2.0 auth token.
   * @returns The Admin Directory service instance.
   */
  async getAdminService(version: string, scopes: string[], authToken: string): Promise<admin_directory_v1.Admin> {
    return createApiClient<admin_directory_v1.Admin>(
      options => google.admin({ ...options, version: 'directory_v1' }),
      version,
      scopes,
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Gets an instance of the Admin Reports service.
   * @param scopes The scopes to request.
   * @param authToken The OAuth 2.0 auth token.
   * @returns The Admin Reports service instance.
   */
  async getReportsService(scopes: string[], authToken: string): Promise<admin_reports_v1.Admin> {
    return createApiClient<admin_reports_v1.Admin>(
      options => google.admin({ ...options, version: 'reports_v1' }),
      API_VERSIONS.ADMIN_REPORTS,
      scopes,
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Gets an instance of the Licensing service.
   * @param version The API version to use.
   * @param scopes The scopes to request.
   * @param authToken The OAuth 2.0 auth token.
   * @returns The Licensing service instance.
   */
  async getLicensingService(version: string, scopes: string[], authToken: string): Promise<licensing_v1.Licensing> {
    return createApiClient<licensing_v1.Licensing>(
      options => google.licensing({ ...options, version: 'v1' }),
      version,
      scopes,
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Retrieves the customer ID for the authenticated user.
   * @param authToken The OAuth 2.0 auth token.
   * @returns The customer object containing the ID.
   * @throws {Error} If the API call fails.
   */
  async getCustomerId(authToken: string): Promise<admin_directory_v1.Schema$Customer> {
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

  /**
   * Lists all organizational units for the current customer.
   * @param options Options for listing OUs.
   * @param options.customerId The customer ID to list OUs for.
   * @param authToken The OAuth 2.0 auth token.
   * @returns The list of organizational units.
   * @throws {Error} If the API call fails.
   */
  async listOrgUnits(options: { customerId?: string }, authToken: string): Promise<admin_directory_v1.Schema$OrgUnits> {
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

  /**
   * Lists Chrome activity logs.
   * @param options Filter options for the activity log query.
   * @param options.userKey The user key to get activities for.
   * @param options.eventName The name of the event to filter by.
   * @param options.startTime The start time of the range to get activities for.
   * @param options.endTime The end time of the range to get activities for.
   * @param options.maxResults The maximum number of results to return.
   * @param options.customerId The customer ID.
   * @param authToken The OAuth 2.0 auth token.
   * @returns An array of activity items.
   * @throws {Error} If the API call fails.
   */
  async listChromeActivities(
    options: {
      userKey?: string
      eventName?: string
      startTime?: string
      endTime?: string
      maxResults?: number
      customerId?: string
    },
    authToken: string,
  ): Promise<admin_reports_v1.Schema$Activity[] | undefined> {
    logger.debug(`${TAGS.API} listChromeActivities called with options: ${JSON.stringify(options)}`)
    const service = await this.getReportsService([SCOPES.ADMIN_REPORTS_AUDIT_READONLY], authToken)
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

  /**
   * Checks if the customer has a Chrome Enterprise Premium subscription.
   * @param customerId The customer ID.
   * @param authToken The OAuth 2.0 auth token.
   * @returns The licensing information.
   * @throws {Error} If the API call fails or the Licensing API is not enabled.
   */
  async checkCepSubscription(
    customerId: string | undefined,
    authToken: string,
  ): Promise<licensing_v1.Schema$LicenseAssignmentList> {
    logger.debug(`${TAGS.API} checkCepSubscription called`)

    const initialCustomerId = customerId || CURRENT_CUSTOMER
    let resolvedCustomerId = initialCustomerId
    if (initialCustomerId === CURRENT_CUSTOMER) {
      const customer = await this.getCustomerId(authToken)
      resolvedCustomerId = customer.id || initialCustomerId
    }

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
      handleLicensingError(error, 'checking CEP subscription')
    }
  }

  /**
   * Checks if a specific user has a Chrome Enterprise Premium license.
   * @param userId The user's email or unique ID.
   * @param authToken The OAuth 2.0 auth token.
   * @returns The license assignment object if found, or null if not.
   * @throws {Error} If the API call fails or the Licensing API is not enabled.
   */
  async checkUserCepLicense(userId: string, authToken: string): Promise<licensing_v1.Schema$LicenseAssignment | null> {
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
      if (isApiError(error)) {
        if (error.response?.status === 404) {
          return null
        }
      }
      handleLicensingError(error, `checking license for user ${userId}`)
    }
  }
}

/**
 * Helper to handle Licensing API specific errors, exposing 403 enabling instructions.
 * @param error The error object.
 * @param operationDescription Description of the operation that failed.
 * @throws Formatted error.
 */
function handleLicensingError(error: unknown, operationDescription: string): never {
  if (isApiError(error)) {
    if (error.response?.status === 403) {
      const data = error.response.data
      if (data && data.error && typeof data.error === 'object') {
        const message = data.error.message || ''
        if (message.includes(SERVICE_NAMES.LICENSING)) {
          throw new Error(
            `API [${SERVICE_NAMES.LICENSING}] is not enabled. Please enable it at https://console.cloud.google.com/apis/library/${SERVICE_NAMES.LICENSING}`,
          )
        }
      }
      throw new Error(
        `Access denied to Licensing API. The account may not have permission to access licensing information.`,
      )
    }
  }
  handleApiError(error, TAGS.API, operationDescription)
}
