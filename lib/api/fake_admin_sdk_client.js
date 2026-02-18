/**
 * @fileoverview Fake implementation of the AdminSdkClient interface for testing.
 */
import axios from 'axios'
import { AdminSdkClient } from './interfaces/admin_sdk_client.js'
import { TAGS } from '../constants.js'
import { URL } from 'url'

export class FakeAdminSdkClient extends AdminSdkClient {
    constructor(rootUrl) {
        super()
        this.rootUrl = rootUrl
    }

    async getCustomerId(authToken) {
        const url = new URL('/admin/directory/v1/customers/my_customer', this.rootUrl).href
        console.log(`${TAGS.API} [FAKE] GET ${url}`)
        const response = await axios.get(url)
        return response.data
    }

    async listOrgUnits(options, authToken) {
        const customerId = options.customerId || 'my_customer'
        const url = new URL(`/admin/directory/v1/customers/${customerId}/orgunits`, this.rootUrl).href
        console.log(`${TAGS.API} [FAKE] GET ${url}`)
        const response = await axios.get(url, { params: { type: 'ALL' } })
        return response.data
    }

    async listChromeActivities(options, authToken) {
        const customerId = options.customerId || 'my_customer'
        const userKey = options.userKey || 'all'
        const url = new URL(`/admin/reports/v1/activity/users/${userKey}/applications/chrome`, this.rootUrl).href
        console.log(`${TAGS.API} [FAKE] GET ${url}`)
        const response = await axios.get(url, { params: options })
        return response.data.items
    }
}
