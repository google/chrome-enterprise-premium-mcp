/**
 * @fileoverview Interface for Google Cloud Identity API client wrappers.
 */

/**
 * @interface CloudIdentityClient
 */
export class CloudIdentityClient {
    /**
     * Lists DLP rules or detectors for a given customer.
     * @param {string} type - The policy type to filter ('rule' or 'detector')
     * @param {string} [authToken] - Optional OAuth token
     * @returns {Promise<Array<object>>} A promise that resolves to a list of policies
     * @throws {Error} If the API call fails
     */
    async listDlpPolicies(type, authToken) {
        throw new Error('Not implemented')
    }

    /**
     * Creates a new Chrome DLP Rule.
     * @param {string} customerId
     * @param {string} orgUnitId
     * @param {object} ruleConfig
     * @param {boolean} [validateOnly=false]
     * @param {string} [authToken]
     * @returns {Promise<object>}
     * @throws {Error}
     */
    async createDlpRule(customerId, orgUnitId, ruleConfig, validateOnly = false, authToken) {
        throw new Error('Not implemented')
    }

    /**
     * Deletes a DLP policy.
     * @param {string} policyName
     * @param {string} [authToken]
     * @returns {Promise<object>}
     * @throws {Error}
     */
    async deleteDlpRule(policyName, authToken) {
        throw new Error('Not implemented')
    }

    /**
     * Creates a new URL blocking list.
     * @param {string} customerId
     * @param {string} orgUnitId
     * @param {object} urlListConfig
     * @param {string} [authToken]
     * @returns {Promise<object>}
     * @throws {Error}
     */
    async createUrlList(customerId, orgUnitId, urlListConfig, authToken) {
        throw new Error('Not implemented')
    }
}
