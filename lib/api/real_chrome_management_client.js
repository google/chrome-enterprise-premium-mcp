/**
 * @fileoverview Real implementation of the ChromeManagementClient interface using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'
import { ChromeManagementClient } from './interfaces/chrome_management_client.js'

export class RealChromeManagementClient extends ChromeManagementClient {
  constructor(apiOptions = {}) {
    super()
    this.apiOptions = apiOptions
  }

  async getClient(authToken) {
    return createApiClient(
      google.chromemanagement,
      API_VERSIONS.CHROME_MANAGEMENT,
      [SCOPES.CHROME_MANAGEMENT_REPORTS_READONLY],
      authToken,
      this.apiOptions,
    )
  }

  // TODO: Remove progressCallback and elsewhere.
  async countBrowserVersions(customerId, orgUnitId, progressCallback) {
    if (!customerId) {
      throw new Error('customerId is required for countBrowserVersions')
    }
    const client = await this.getClient(null)
    try {
      const message = `Counting browser versions for customer ${customerId}...`
      console.error(`${TAGS.API} ${message}`)
      progressCallback?.({ level: 'info', data: message })

      const request = { customer: `customers/${customerId}` }
      if (orgUnitId) {
        request.orgUnitId = orgUnitId
      }
      const response = await callWithRetry(
        () => client.customers.reports.countChromeVersions(request),
        'reports.countChromeVersions',
      )
      return response.data.browserVersions
    } catch (error) {
      console.error(`${TAGS.API} ✗ Error counting browser versions:`, error)
      throw error
    }
  }

  async listCustomerProfiles(customerId, progressCallback) {
    if (!customerId) {
      throw new Error('customerId is required for listCustomerProfiles')
    }
    const client = await this.getClient(null)
    try {
      const message = `Listing customer profiles for customer ${customerId}...`
      console.error(`${TAGS.API} ${message}`)
      progressCallback?.({ level: 'info', data: message })

      const request = { parent: `customers/${customerId}` }
      const response = await callWithRetry(() => client.customers.profiles.list(request), 'profiles.list')
      return response.data.chromeBrowserProfiles
    } catch (error) {
      console.error(`${TAGS.API} ✗ Error listing customer profiles:`, error)
      throw error
    }
  }
}
