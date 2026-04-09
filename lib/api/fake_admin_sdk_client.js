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
 * @fileoverview Fake implementation of the AdminSdkClient interface for testing.
 */
import axios from 'axios'
import { AdminSdkClient } from './interfaces/admin_sdk_client.js'
import { TAGS, CEP_CONSTANTS } from '../constants.js'
import { URL } from 'url'
import { logger } from '../util/logger.js'

export class FakeAdminSdkClient extends AdminSdkClient {
  constructor(rootUrl) {
    super()
    this.rootUrl = rootUrl
  }

  async getCustomerId(_authToken) {
    const url = new URL('/admin/directory/v1/customers/my_customer', this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] GET ${url}`)
    const response = await axios.get(url)
    return response.data
  }

  async listOrgUnits(options, _authToken) {
    const customerId = options.customerId || 'my_customer'
    const url = new URL(`/admin/directory/v1/customers/${customerId}/orgunits`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] GET ${url}`)
    const response = await axios.get(url, { params: { type: 'ALL_INCLUDING_PARENT' } })
    return response.data
  }

  async listChromeActivities(options, _authToken) {
    const userKey = options.userKey || 'all'
    const url = new URL(`/admin/reports/v1/activity/users/${userKey}/applications/chrome`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] GET ${url}`)
    const response = await axios.get(url, { params: options })
    return response.data.items
  }

  async checkCepSubscription(customerId, _authToken) {
    const cid = customerId || 'my_customer'
    const url = new URL(
      `/licensing/v1/product/${CEP_CONSTANTS.PRODUCT_ID}/sku/${CEP_CONSTANTS.SKU_ID}/user`,
      this.rootUrl,
    ).href
    logger.debug(`${TAGS.API} [FAKE] GET ${url}`)
    const response = await axios.get(url, { params: { customerId: cid } })
    return response.data
  }

  async checkUserCepLicense(userId, _authToken) {
    const url = new URL(
      `/licensing/v1/product/${CEP_CONSTANTS.PRODUCT_ID}/sku/${CEP_CONSTANTS.SKU_ID}/user/${userId}`,
      this.rootUrl,
    ).href
    logger.debug(`${TAGS.API} [FAKE] GET ${url}`)
    try {
      const response = await axios.get(url)
      return response.data
    } catch (error) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  }
}
