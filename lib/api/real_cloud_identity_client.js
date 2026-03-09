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
 * @fileoverview Real implementation of the CloudIdentityClient interface using googleapis.
 */
import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry, handleApiError } from '../util/helpers.js'
import {
  SCOPES,
  API_VERSIONS,
  TAGS,
  CHROME_DLP_TRIGGERS,
  CLOUD_IDENTITY_SETTING_TYPES,
  CLOUD_IDENTITY_FILTERS,
} from '../constants.js'
import { CloudIdentityClient } from './interfaces/cloud_identity_client.js'
import { logger } from '../util/logger.js'

export class RealCloudIdentityClient extends CloudIdentityClient {
  constructor(apiOptions = {}) {
    super()
    this.apiOptions = apiOptions
  }

  async getPolicyClient(authToken) {
    return createApiClient(
      google.cloudidentity,
      API_VERSIONS.CLOUD_IDENTITY,
      [SCOPES.CLOUD_IDENTITY_POLICIES],
      authToken,
      this.apiOptions,
    )
  }

  async listDlpRules(authToken) {
    logger.debug(`${TAGS.API} listDlpRules called`)
    return this._listPolicies(CLOUD_IDENTITY_FILTERS.DLP_RULE, authToken)
  }

  async listDetectors(authToken) {
    logger.debug(`${TAGS.API} listDetectors called`)
    return this._listPolicies(CLOUD_IDENTITY_FILTERS.DETECTOR, authToken)
  }

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

  async createDlpRule(customerId, orgUnitId, ruleConfig, validateOnly = false, authToken) {
    logger.debug(
      `${TAGS.API} createDlpRule called with customerId: ${customerId}, orgUnitId: ${orgUnitId}, ruleConfig: ${JSON.stringify(
        ruleConfig,
      )}, validateOnly: ${validateOnly}`,
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
      if (validateOnly) {
        request.validateOnly = true
      }
      logger.debug(`${TAGS.API} Sending policies.create request: ${JSON.stringify(request, null, 2)}`)
      const response = await callWithRetry(() => client.policies.create(request), 'policies.create')
      return response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'creating DLP rule')
    }
  }

  async deleteDlpRule(policyName, authToken) {
    logger.debug(`${TAGS.API} deleteDlpRule called with policyName: ${policyName}`)
    return this._deletePolicyWithValidation(
      policyName,
      policy => {
        const triggers = policy.setting?.value?.triggers || []
        const chromeTriggers = Object.values(CHROME_DLP_TRIGGERS)
        return triggers.some(trigger => chromeTriggers.includes(trigger))
      },
      'Chrome DLP rule',
      authToken,
    )
  }

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
      return response.data.response || response.data
    } catch (error) {
      handleApiError(error, TAGS.API, 'creating detector')
    }
  }

  async deleteDetector(policyName, authToken) {
    logger.debug(`${TAGS.API} deleteDetector called with policyName: ${policyName}`)
    return this._deletePolicyWithValidation(
      policyName,
      policy => policy.setting?.type?.includes('detector'),
      'DLP Detector',
      authToken,
    )
  }

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
