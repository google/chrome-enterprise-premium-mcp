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
 * @file Fake implementation of the CloudIdentityClient interface for testing.
 */
import axios from 'axios'
import { CloudIdentityClient } from './interfaces/cloud_identity_client.js'
import { TAGS, CLOUD_IDENTITY_SETTING_TYPES, CLOUD_IDENTITY_FILTERS } from '../constants.js'
import { URL } from 'url'
import { logger } from '../util/logger.js'

/**
 * Fake implementation of the CloudIdentityClient for testing purposes.
 * Simulates API calls to Cloud Identity and DLP services.
 */
export class FakeCloudIdentityClient extends CloudIdentityClient {
  /**
   * Initializes the fake client with a root URL for the mock server.
   * @param {string} rootUrl The base URL of the mock identity service.
   */
  constructor(rootUrl) {
    super()
    this.rootUrl = rootUrl
  }

  /**
   * Lists all Chrome DLP rules.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object[]>} A promise that resolves to an array of DLP rules.
   */
  async listDlpRules(_authToken) {
    return this._listPolicies(CLOUD_IDENTITY_FILTERS.DLP_RULE, _authToken)
  }

  /**
   * Lists all custom Chrome DLP detectors.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object[]>} A promise that resolves to an array of detectors.
   */
  async listDetectors(_authToken) {
    return this._listPolicies(CLOUD_IDENTITY_FILTERS.DETECTOR, _authToken)
  }

  /**
   * Internal helper to list policies based on a filter.
   * @param {string} filter The filter string for the policies API.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object[]>} A promise that resolves to the matching policies.
   */
  async _listPolicies(filter, _authToken) {
    const url = new URL(`/v1beta1/policies`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] GET ${url} with filter ${filter}`)
    const response = await axios.get(url, { params: { filter } })
    return response.data.policies
  }

  /**
   * Creates a new Chrome DLP rule.
   * @param {string} customerId The unique identifier for the customer.
   * @param {string} orgUnitId The organizational unit ID where the rule will be applied.
   * @param {object} ruleConfig The configuration for the new rule.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object>} A promise that resolves to the created rule.
   */
  async createDlpRule(customerId, orgUnitId, ruleConfig, _authToken) {
    const url = new URL(`/v1beta1/customers/${customerId}/policies`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] POST ${url}`)
    const requestBody = {
      customer: `customers/${customerId}`,
      policyQuery: {
        orgUnit: `orgUnits/${orgUnitId}`,
      },
      setting: { type: CLOUD_IDENTITY_SETTING_TYPES.DLP_RULE, value: ruleConfig },
    }
    const response = await axios.post(url, requestBody)
    return response.data
  }

  /**
   * Deletes an existing Chrome DLP rule.
   * @param {string} policyName The resource name of the rule to delete.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object>} A promise that resolves to the deletion confirmation.
   */
  async deleteDlpRule(policyName, _authToken) {
    const url = new URL(`/v1beta1/${policyName}`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] DELETE ${url}`)
    const response = await axios.delete(url)
    return response.data
  }

  /**
   * Retrieves details of a specific Chrome DLP rule.
   * @param {string} policyName The resource name of the rule to retrieve.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object>} A promise that resolves to the rule details.
   */
  async getDlpRule(policyName, _authToken) {
    const url = new URL(`/v1beta1/${policyName}`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] GET ${url}`)
    const response = await axios.get(url)
    return response.data
  }

  /**
   * Retrieves details of a specific Chrome DLP detector.
   * @param {string} policyName The resource name of the detector to retrieve.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object>} A promise that resolves to the detector details.
   */
  async getDetector(policyName, _authToken) {
    const url = new URL(`/v1beta1/${policyName}`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] GET ${url}`)
    const response = await axios.get(url)
    return response.data
  }

  /**
   * Creates a new custom Chrome DLP detector.
   * @param {string} customerId The unique identifier for the customer.
   * @param {string} orgUnitId The organizational unit ID where the detector will be defined.
   * @param {object} detectorConfig The configuration for the new detector.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object>} A promise that resolves to the created detector.
   */
  async createDetector(customerId, orgUnitId, detectorConfig, _authToken) {
    const url = new URL(`/v1beta1/customers/${customerId}/policies`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] POST ${url}`)

    let detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR
    if (detectorConfig.url_list) {
      detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR_URL_LIST
    } else if (detectorConfig.word_list) {
      detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR_WORD_LIST
    } else if (detectorConfig.regular_expression) {
      detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR_REGEX
    }

    const requestBody = {
      customer: `customers/${customerId}`,
      policyQuery: {
        orgUnit: `orgUnits/${orgUnitId}`,
      },
      setting: { type: detectorType, value: detectorConfig },
    }
    const response = await axios.post(url, requestBody)
    return response.data
  }

  /**
   * Deletes an existing Chrome DLP detector.
   * @param {string} policyName The resource name of the detector to delete.
   * @param {string} _authToken OAuth2 token for authentication (unused in fake).
   * @returns {Promise<object>} A promise that resolves to the deletion confirmation.
   */
  async deleteDetector(policyName, _authToken) {
    const url = new URL(`/v1beta1/${policyName}`, this.rootUrl).href
    logger.debug(`${TAGS.API} [FAKE] DELETE ${url}`)
    const response = await axios.delete(url)
    return response.data
  }
}
