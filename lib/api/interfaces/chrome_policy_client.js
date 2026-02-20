/**
 * @fileoverview Interface for Google Chrome Policy API client wrappers.
 */

/**
 * @interface ChromePolicyClient
 */
export class ChromePolicyClient {
  /**
   * Retrieves the connector policy for a specific customer and organizational unit.
   * @param {string} customerId
   * @param {string} orgUnitId
   * @param {string} policySchemaFilter
   * @param {function(object): void} [progressCallback]
   * @param {string} [authToken]
   * @returns {Promise<Array<object>>}
   * @throws {Error}
   */
  async getConnectorPolicy(customerId, orgUnitId, policySchemaFilter, progressCallback, authToken) {
    throw new Error('Not implemented')
  }
}
