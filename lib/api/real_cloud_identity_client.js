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
 * @file Real implementation of the CloudIdentityClient interface using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS, CLOUD_IDENTITY_SETTING_TYPES, CLOUD_IDENTITY_FILTERS } from '../constants.js'
import { CloudIdentityClient } from './interfaces/cloud_identity_client.js'
import { CHROME_TRIGGERS } from '../util/chrome_dlp_constants.js'
import { logger } from '../util/logger.js'

/**
 * Real implementation of the CloudIdentityClient interface.
 */
export class RealCloudIdentityClient extends CloudIdentityClient {
  /**
   * Initializes the RealCloudIdentityClient.
   * @param {object} [apiOptions] Configuration options for the API client.
   */
  constructor(apiOptions = {}) {
    super()
    this.apiOptions = apiOptions
  }

  /**
   * Gets an authenticated Cloud Identity Policies API client.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The Cloud Identity Policies API client.
   */
  async getPolicyClient(authToken) {
    return createApiClient(
      google.cloudidentity,
      API_VERSIONS.CLOUD_IDENTITY,
      [SCOPES.CLOUD_IDENTITY_POLICIES],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Lists all Chrome DLP rules.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<Array<object>>} An array of DLP rules.
   */
  async listDlpRules(authToken) {
    logger.debug(`${TAGS.API} listDlpRules called`)
    return this._listPolicies(CLOUD_IDENTITY_FILTERS.DLP_RULE, authToken)
  }

  /**
   * Lists all Chrome DLP detectors.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<Array<object>>} An array of detectors.
   */
  async listDetectors(authToken) {
    logger.debug(`${TAGS.API} listDetectors called`)
    return this._listPolicies(CLOUD_IDENTITY_FILTERS.DETECTOR, authToken)
  }

  /**
   * Internal method to list policies with a filter.
   * @param {string} filter The filter to apply when listing policies.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<Array<object>>} An array of policies.
   * @private
   */
  async _listPolicies(filter, authToken) {
    const client = await this.getPolicyClient(authToken)
    try {
      let nextPageToken
      const allPolicies = []
      do {
        const request = {
          filter,
          pageSize: 50,
          pageToken: nextPageToken,
        }
        const response = await callWithRetry(() => client.policies.list(request), 'policies.list')
        if (response.data.policies) {
          allPolicies.push(...response.data.policies)
        }
        nextPageToken = response.data.nextPageToken
      } while (nextPageToken)
      return allPolicies
    } catch (error) {
      handleApiError(error, TAGS.API, 'listing policies')
    }
  }

  /**
   * Creates a new Chrome DLP rule.
   * @param {string} customerId The ID of the customer.
   * @param {string} orgUnitId The ID of the organizational unit.
   * @param {object} ruleConfig The configuration for the DLP rule.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The created policy data.
   */
  async createDlpRule(customerId, orgUnitId, ruleConfig, authToken) {
    logger.debug(
      `${TAGS.API} createDlpRule called with customerId: ${customerId}, orgUnitId: ${orgUnitId}, ruleConfig: ${JSON.stringify(
        ruleConfig,
      )}`,
    )
    const client = await this.getPolicyClient(authToken)
    try {
      const request = {
        requestBody: {
          customer: `customers/${customerId}`,
          policyQuery: {
            orgUnit: `orgUnits/${orgUnitId}`,
          },
          setting: {
            type: CLOUD_IDENTITY_SETTING_TYPES.DLP_RULE,
            value: ruleConfig,
          },
        },
      }
      logger.debug(`${TAGS.API} Sending policies.create request: ${JSON.stringify(request, null, 2)}`)
      const response = await callWithRetry(() => client.policies.create(request), 'policies.create')
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'creating DLP rule')
    }
  }

  /**
   * Deletes a Chrome DLP rule with validation.
   * @param {string} policyName The resource name of the policy to delete.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The API response data.
   */
  async deleteDlpRule(policyName, authToken) {
    logger.debug(`${TAGS.API} deleteDlpRule called with policyName: ${policyName}`)
    return this._deletePolicyWithValidation(
      policyName,
      policy => {
        const triggers = policy.setting?.value?.triggers || []
        const chromeTriggers = Object.values(CHROME_TRIGGERS).map(t => t.value)
        return triggers.some(trigger => chromeTriggers.includes(trigger))
      },
      'Chrome DLP rule',
      authToken,
    )
  }

  /**
   * Gets a specific Chrome DLP rule.
   * @param {string} policyName The resource name of the policy to retrieve.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The policy data.
   */
  async getDlpRule(policyName, authToken) {
    logger.debug(`${TAGS.API} getDlpRule called with policyName: ${policyName}`)
    const client = await this.getPolicyClient(authToken)
    try {
      const response = await callWithRetry(() => client.policies.get({ name: policyName }), 'policies.get')
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'getting DLP rule')
    }
  }

  /**
   * Gets a specific detector.
   * @param {string} policyName The resource name of the detector to retrieve.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The detector data.
   */
  async getDetector(policyName, authToken) {
    logger.debug(`${TAGS.API} getDetector called with policyName: ${policyName}`)
    const client = await this.getPolicyClient(authToken)
    try {
      const response = await callWithRetry(() => client.policies.get({ name: policyName }), 'policies.get')
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'getting detector')
    }
  }

  /**
   * Creates a new detector.
   * @param {string} customerId The ID of the customer.
   * @param {string} orgUnitId The ID of the organizational unit.
   * @param {object} detectorConfig The configuration for the detector.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The created detector data.
   * @throws {Error} If the detector type is unsupported.
   */
  async createDetector(customerId, orgUnitId, detectorConfig, authToken) {
    logger.debug(
      `${TAGS.API} createDetector called with customerId: ${customerId}, orgUnitId: ${orgUnitId}, detectorConfig: ${JSON.stringify(
        detectorConfig,
      )}`,
    )
    const client = await this.getPolicyClient(authToken)
    try {
      let detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR
      if (detectorConfig.url_list) {
        detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR_URL_LIST
      } else if (detectorConfig.word_list) {
        detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR_WORD_LIST
      } else if (detectorConfig.regular_expression) {
        detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR_REGEX
      } else {
        throw new Error(`Unsupported detector type: ${JSON.stringify(detectorConfig)}`)
      }

      const request = {
        requestBody: {
          customer: `customers/${customerId}`,
          policyQuery: {
            orgUnit: `orgUnits/${orgUnitId}`,
          },
          setting: {
            type: detectorType,
            value: detectorConfig,
          },
        },
      }
      const response = await callWithRetry(() => client.policies.create(request), 'policies.create')
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'creating detector')
    }
  }

  /**
   * Deletes a detector with validation.
   * @param {string} policyName The resource name of the detector to delete.
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The API response data.
   */
  async deleteDetector(policyName, authToken) {
    logger.debug(`${TAGS.API} deleteDetector called with policyName: ${policyName}`)
    return this._deletePolicyWithValidation(
      policyName,
      policy => policy.setting?.type?.includes('detector'),
      'DLP Detector',
      authToken,
    )
  }

  /**
   * Internal method to delete a policy after validating it against a provided function.
   * @param {string} policyName The resource name of the policy to delete.
   * @param {(...args: unknown[]) => unknown} validationFn A function to validate the policy before deletion.
   * @param {string} typeDisplay A display name for the policy type (for error messages).
   * @param {string} [authToken] Optional authentication token.
   * @returns {Promise<object>} The API response data.
   * @throws {Error} If the policy fails validation.
   * @private
   */
  async _deletePolicyWithValidation(policyName, validationFn, typeDisplay, authToken) {
    const client = await this.getPolicyClient(authToken)
    try {
      const getResponse = await callWithRetry(() => client.policies.get({ name: policyName }), 'policies.get')
      const policy = getResponse.data

      if (validationFn(policy)) {
        const deleteResponse = await callWithRetry(
          () => client.policies.delete({ name: policyName }),
          'policies.delete',
        )
        return deleteResponse.data
      } else {
        throw new Error(`Policy ${policyName} is not a ${typeDisplay}.`)
      }
    } catch (error) {
      handleApiError(error, TAGS.API, `deleting ${typeDisplay} policy`)
    }
  }
}
