/**
 * @fileoverview Fake implementation of the ChromeManagementClient interface for testing.
 */
import axios from 'axios'
import { ChromeManagementClient } from './interfaces/chrome_management_client.js'
import { TAGS } from '../constants.js'
import { URL } from 'url'

export class FakeChromeManagementClient extends ChromeManagementClient {
  constructor(rootUrl) {
    super()
    this.rootUrl = rootUrl
  }

  async countBrowserVersions(customerId, orgUnitId, progressCallback) {
    const url = new URL(`/v1/customers/${customerId}/reports:countChromeVersions`, this.rootUrl).href
    console.log(`${TAGS.API} [FAKE] GET ${url}`)
    const params = orgUnitId ? { orgUnitId } : {}
    const response = await axios.get(url, { params })
    return response.data.browserVersions
  }

  async listCustomerProfiles(customerId, progressCallback) {
    const url = new URL(`/v1/customers/${customerId}/profiles`, this.rootUrl).href
    console.log(`${TAGS.API} [FAKE] GET ${url}`)
    const response = await axios.get(url)
    return response.data.chromeBrowserProfiles
  }
}
