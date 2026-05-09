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
 * @file Cloud Identity API client wrapper using googleapis.
 */

import { google, cloudidentity_v1beta1 } from 'googleapis'
import { createApiClient, ApiOptions } from '../util/api-client.js'
import { callWithRetry, handleApiError, isObject, getStringArray } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS, CLOUD_IDENTITY_SETTING_TYPES, CLOUD_IDENTITY_FILTERS } from '../constants.js'
import { CHROME_TRIGGERS } from '../util/chrome_dlp_constants.js'
import { logger } from '../util/logger.js'

/**
 * Cloud Identity API client wrapper using googleapis.
 */
export class CloudIdentityClient {
  private apiOptions: ApiOptions

  /**
   * Initializes the CloudIdentityClient.
   * @param apiOptions Configuration options for the API client.
   */
  constructor(apiOptions: ApiOptions = {}) {
    this.apiOptions = apiOptions
  }

  /**
   * Gets an authenticated Cloud Identity Policies API client.
   * @param authToken Optional authentication token.
   * @returns The Cloud Identity Policies API client.
   */
  async getPolicyClient(authToken?: string): Promise<cloudidentity_v1beta1.Cloudidentity> {
    return createApiClient<cloudidentity_v1beta1.Cloudidentity>(
      options => google.cloudidentity({ ...options, version: 'v1beta1' }),
      API_VERSIONS.CLOUD_IDENTITY,
      [SCOPES.CLOUD_IDENTITY_POLICIES],
      authToken,
      this.apiOptions,
    )
  }

  /**
   * Lists all Chrome DLP rules.
   * @param authToken Optional authentication token.
   * @returns An array of DLP rules.
   */
  async listDlpRules(authToken?: string): Promise<cloudidentity_v1beta1.Schema$Policy[]> {
    logger.debug(`${TAGS.API} listDlpRules called`)
    return this._listPolicies(CLOUD_IDENTITY_FILTERS.DLP_RULE, authToken)
  }

  /**
   * Lists all Chrome DLP detectors.
   * @param authToken Optional authentication token.
   * @returns An array of detectors.
   */
  async listDetectors(authToken?: string): Promise<cloudidentity_v1beta1.Schema$Policy[]> {
    logger.debug(`${TAGS.API} listDetectors called`)
    return this._listPolicies(CLOUD_IDENTITY_FILTERS.DETECTOR, authToken)
  }

  /**
   * Internal method to list policies with a filter.
   * @param filter The filter to apply when listing policies.
   * @param authToken Optional authentication token.
   * @returns An array of policies.
   */
  async _listPolicies(filter: string, authToken?: string): Promise<cloudidentity_v1beta1.Schema$Policy[]> {
    const client = await this.getPolicyClient(authToken)
    try {
      let nextPageToken: string | undefined
      const allPolicies: cloudidentity_v1beta1.Schema$Policy[] = []
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
        nextPageToken = response.data.nextPageToken || undefined
      } while (nextPageToken)
      return allPolicies
    } catch (error) {
      handleApiError(error, TAGS.API, 'listing policies')
    }
  }

  /**
   * Creates a new Chrome DLP rule.
   * @param customerId The ID of the customer.
   * @param orgUnitId The ID of the organizational unit.
   * @param ruleConfig The configuration for the DLP rule.
   * @param authToken Optional authentication token.
   * @returns The created policy data.
   */
  async createDlpRule(
    customerId: string,
    orgUnitId: string,
    ruleConfig: Record<string, unknown>,
    authToken?: string,
  ): Promise<cloudidentity_v1beta1.Schema$Policy> {
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
   * @param policyName The resource name of the policy to delete.
   * @param authToken Optional authentication token.
   * @returns The API response data.
   */
  async deleteDlpRule(policyName: string, authToken?: string): Promise<unknown> {
    logger.debug(`${TAGS.API} deleteDlpRule called with policyName: ${policyName}`)
    return this._deletePolicyWithValidation(
      policyName,
      policy => {
        const setting = policy.setting
        const value = setting && isObject(setting.value) ? setting.value : null
        const triggerList = value ? getStringArray(value, 'triggers') : null
        const triggers = triggerList || []
        const chromeTriggers = Object.values(CHROME_TRIGGERS).map(t => t.value)
        return triggers.some(trigger => chromeTriggers.includes(trigger))
      },
      'Chrome DLP rule',
      authToken,
    )
  }

  /**
   * Deletes a DLP rule without re-fetching for validation. The caller is
   * responsible for confirming the policy is a Chrome DLP rule before invoking.
   * @param policyName The resource name of the policy to delete.
   * @param authToken Optional authentication token.
   * @returns The API response data.
   */
  async deleteDlpRulePreValidated(policyName: string, authToken?: string): Promise<unknown> {
    logger.debug(`${TAGS.API} deleteDlpRulePreValidated called with policyName: ${policyName}`)
    const client = await this.getPolicyClient(authToken)
    try {
      const deleteResponse = await callWithRetry(() => client.policies.delete({ name: policyName }), 'policies.delete')
      return deleteResponse.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'deleting Chrome DLP rule')
    }
  }

  /**
   * Gets a specific Chrome DLP rule.
   * @param policyName The resource name of the policy to retrieve.
   * @param authToken Optional authentication token.
   * @returns The policy data.
   */
  async getDlpRule(policyName: string, authToken?: string): Promise<cloudidentity_v1beta1.Schema$Policy> {
    return this._getPolicy(policyName, 'DLP rule', authToken)
  }

  /**
   * Gets a specific detector.
   * @param policyName The resource name of the detector to retrieve.
   * @param authToken Optional authentication token.
   * @returns The detector data.
   */
  async getDetector(policyName: string, authToken?: string): Promise<cloudidentity_v1beta1.Schema$Policy> {
    return this._getPolicy(policyName, 'detector', authToken)
  }

  /**
   * Creates a new detector.
   * @param customerId The ID of the customer.
   * @param orgUnitId The ID of the organizational unit.
   * @param detectorConfig The configuration for the detector.
   * @param authToken Optional authentication token.
   * @returns The created detector data.
   * @throws If the detector type is unsupported.
   */
  async createDetector(
    customerId: string,
    orgUnitId: string,
    detectorConfig: Record<string, unknown>,
    authToken?: string,
  ): Promise<cloudidentity_v1beta1.Schema$Policy> {
    logger.debug(
      `${TAGS.API} createDetector called with customerId: ${customerId}, orgUnitId: ${orgUnitId}, detectorConfig: ${JSON.stringify(
        detectorConfig,
      )}`,
    )
    const client = await this.getPolicyClient(authToken)
    try {
      let detectorType: string
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
   * @param policyName The resource name of the detector to delete.
   * @param authToken Optional authentication token.
   * @returns The API response data.
   */
  async deleteDetector(policyName: string, authToken?: string): Promise<unknown> {
    logger.debug(`${TAGS.API} deleteDetector called with policyName: ${policyName}`)
    return this._deletePolicyWithValidation(
      policyName,
      policy => {
        const type = policy.setting?.type
        return typeof type === 'string' && type.includes('detector')
      },
      'DLP Detector',
      authToken,
    )
  }

  /**
   * Internal method to retrieve a policy by name.
   * @param policyName The resource name of the policy to retrieve.
   * @param typeDisplay A display name for the policy type (for error messages).
   * @param authToken Optional authentication token.
   * @returns The policy data.
   */
  async _getPolicy(
    policyName: string,
    typeDisplay: string,
    authToken?: string,
  ): Promise<cloudidentity_v1beta1.Schema$Policy> {
    logger.debug(`${TAGS.API} _getPolicy called for ${typeDisplay}: ${policyName}`)
    const client = await this.getPolicyClient(authToken)
    try {
      const response = await callWithRetry(() => client.policies.get({ name: policyName }), 'policies.get')
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, `getting ${typeDisplay}`)
    }
  }

  /**
   * Internal method to delete a policy after validating it against a provided function.
   * @param policyName The resource name of the policy to delete.
   * @param validationFn A function to validate the policy before deletion.
   * @param typeDisplay A display name for the policy type (for error messages).
   * @param authToken Optional authentication token.
   * @returns The API response data.
   * @throws If the policy fails validation.
   */
  async _deletePolicyWithValidation(
    policyName: string,
    validationFn: (policy: cloudidentity_v1beta1.Schema$Policy) => boolean,
    typeDisplay: string,
    authToken?: string,
  ): Promise<unknown> {
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
