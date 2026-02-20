/**
 * @fileoverview Interface for Google Workspace Admin SDK API client wrappers.
 */

/**
 * @interface AdminSdkClient
 */
export class AdminSdkClient {
  /**
   * Retrieves the customer ID for the authenticated user.
   * @param {string} [authToken] - Optional OAuth token
   * @returns {Promise<object>} A promise that resolves to the customer object containing the ID
   * @throws {Error} If the API call fails
   */
  async getCustomerId(authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Lists all organizational units for the current customer.
   * @param {object} options - Options
   * @param {string} [options.customerId] - The customer ID to list OUs for
   * @param {string} [authToken] - Optional OAuth token
   * @returns {Promise<object>} A promise that resolves to the list of organizational units
   * @throws {Error} If the API call fails
   */
  async listOrgUnits(options, authToken) {
    throw new Error('Not implemented')
  }

  /**
   * Lists Chrome activity logs.
   * @param {object} options - Filter options for the activity log query
   * @param {string} [authToken] - Optional OAuth token
   * @returns {Promise<Array<object>>} A promise that resolves to an array of activity items
   * @throws {Error} If the API call fails
   */
  async listChromeActivities(options, authToken) {
    throw new Error('Not implemented')
  }
}
