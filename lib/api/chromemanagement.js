/**
 * @fileoverview Google Chrome Management API client wrapper.
 *
 * Provides functions to:
 * - Count Chrome browser versions.
 * - List customer profiles.
 */

import { google } from 'googleapis'

import { getAuthClient } from '../util/auth.js'
import { callWithRetry } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS } from '../constants.js'

let managementClient

/**
 * Initializes or returns the cached Chrome Management API client.
 *
 * @param {string} [authToken] - Optional OAuth token
 * @returns {Promise<object>} The Chrome Management API client instance
 */
async function getManagementClient(authToken) {
    if (managementClient) {
        return managementClient
    }

    const authClient = await getAuthClient([SCOPES.CHROME_MANAGEMENT_REPORTS_READONLY], authToken)

    google.options({ auth: authClient })
    managementClient = google.chromemanagement(API_VERSIONS.CHROME_MANAGEMENT)

    return managementClient
}

/**
 * Counts Chrome browser versions for a specific customer.
 *
 * @param {string} customerId - The Google Workspace Customer ID (e.g. C012345)
 * @param {string} [orgUnitId] - The Organizational Unit ID to filter results
 * @param {function(object): void} [progressCallback] - Optional callback for progress updates
 * @returns {Promise<Array<object>>} A promise that resolves to a list of browser version counts
 * @throws {Error} If the API call fails
 */
export async function countBrowserVersions(customerId, orgUnitId, progressCallback) {
    if (!customerId) {
        throw new Error('customerId is required for countBrowserVersions')
    }

    const client = await getManagementClient()

    try {
        const message = `Counting browser versions for customer ${customerId}...`
        console.error(`${TAGS.API} ${message}`)
        progressCallback?.({ level: 'info', data: message })

        const request = {
            customer: `customers/${customerId}`,
        }

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

/**
 * Lists Chrome browser profiles for a specific customer.
 *
 * @param {string} customerId - The Google Workspace Customer ID (e.g. C012345)
 * @param {function(object): void} [progressCallback] - Optional callback for progress updates
 * @returns {Promise<Array<object>>} A promise that resolves to a list of customer profiles
 * @throws {Error} If the API call fails
 */
export async function listCustomerProfiles(customerId, progressCallback) {
    if (!customerId) {
        throw new Error('customerId is required for listCustomerProfiles')
    }

    const client = await getManagementClient()

    try {
        const message = `Listing customer profiles for customer ${customerId}...`
        console.error(`${TAGS.API} ${message}`)
        progressCallback?.({ level: 'info', data: message })

        const request = {
            parent: `customers/${customerId}`,
        }

        const response = await callWithRetry(() => client.customers.profiles.list(request), 'profiles.list')

        return response.data.chromeBrowserProfiles
    } catch (error) {
        console.error(`${TAGS.API} ✗ Error listing customer profiles:`, error)
        throw error
    }
}
