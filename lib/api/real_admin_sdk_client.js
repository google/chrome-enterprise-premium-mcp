/**
 * @fileoverview Real implementation of the AdminSdkClient interface using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry } from '../util/helpers.js'
import { API_VERSIONS, SCOPES, TAGS } from '../constants.js'
import { AdminSdkClient } from './interfaces/admin_sdk_client.js'

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
            console.error(`${TAGS.API} admin_sdk.getCustomerId Error: ${error.message}`, error)
            throw error
        }
    }

    async listOrgUnits(options, authToken) {
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
