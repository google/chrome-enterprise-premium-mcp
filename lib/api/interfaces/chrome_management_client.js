/**
 * @fileoverview Interface for Google Chrome Management API client wrappers.
 */

/**
 * @interface ChromeManagementClient
 */
export class ChromeManagementClient {
  /**
   * Counts Chrome browser versions for a specific customer.
   * @param {string} customerId
   * @param {string} [orgUnitId]
   * @param {function(object): void} [progressCallback]
   * @returns {Promise<Array<object>>}
   * @throws {Error}
   */
  async countBrowserVersions(customerId, orgUnitId, progressCallback) {
    throw new Error('Not implemented')
  }

  /**
   * Lists Chrome browser profiles for a specific customer.
   * @param {string} customerId
   * @param {function(object): void} [progressCallback]
   * @returns {Promise<Array<object>>}
   * @throws {Error}
   */
  async listCustomerProfiles(customerId, progressCallback) {
    throw new Error('Not implemented')
  }
}
