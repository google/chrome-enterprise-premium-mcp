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
import { callWithRetry } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS, CHROME_DLP_TRIGGERS } from '../constants.js'
import { CloudIdentityClient } from './interfaces/cloud_identity_client.js'

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
    return this._listPolicies('setting.type.matches("rule.dlp")', authToken)
  }

  async listDetectors(authToken) {
    return this._listPolicies('setting.type.matches("detector")', authToken)
  }

  async _listPolicies(filter, authToken) {
    const client = await this.getPolicyClient(authToken)
    try {
      console.error(`${TAGS.API} Listing policies with filter: ${filter}...`)

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
      console.error(`${TAGS.API} ✗ Error listing policies:`, error)
      throw error
    }
  }

  async createDlpRule(customerId, orgUnitId, ruleConfig, validateOnly = false, authToken) {
    const client = await this.getPolicyClient(authToken)
    try {
      const message = `Creating DLP Rule for customer ${customerId} in OU ${orgUnitId}...`
      console.error(`${TAGS.API} ${message}`)
      const request = {
        requestBody: {
          customer: `customers/${customerId}`,
          policyQuery: {
            query: `entity.org_units.exists(org_unit, org_unit.org_unit_id == orgUnitId('${orgUnitId}'))`,
          },
          setting: {
            type: 'settings/rule.dlp',
            value: ruleConfig,
          },
        },
      }
      if (validateOnly) {
        request.validateOnly = true
      }
      const response = await callWithRetry(() => client.policies.create(request), 'policies.create')
      console.error(`${TAGS.API} ✓ Successfully created/validated DLP rule: ${response.data.name}`)
      return response.data
    } catch (error) {
      console.error(`${TAGS.API} ✗ Error creating DLP rule:`, error)
      if (error.response?.data?.error) {
        const { code, message, status } = error.response.data.error
        throw new Error(`API Error ${code} (${status}): ${message}`)
      }
      throw error
    }
  }

  async deleteDlpRule(policyName, authToken) {
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
    const client = await this.getPolicyClient(authToken)
    try {
      const message = `Creating Detector for customer ${customerId} in OU ${orgUnitId}...`
      console.error(`${TAGS.API} ${message}`)

      let detectorType = 'settings/detector'
      if (detectorConfig.url_list) {
        detectorType = 'settings/detector.url_list'
      } else if (detectorConfig.word_list) {
        detectorType = 'settings/detector.word_list'
      } else if (detectorConfig.regular_expression) {
        detectorType = 'settings/detector.regular_expression'
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
      const createdName = response.data.response?.name || response.data.name || 'unknown'
      console.error(`${TAGS.API} ✓ Successfully created detector: ${createdName}`)
      return response.data.response || response.data
    } catch (error) {
      console.error(`${TAGS.API} ✗ Error creating detector:`, error)
      const errorData = error.response?.data?.error
      if (errorData) {
        const { code, message, status, details } = errorData
        console.error(`${TAGS.API} ✗ Error details:`, JSON.stringify(details, null, 2))
        throw new Error(`API Error ${code} (${status}): ${message} - ${JSON.stringify(details)}`)
      }
      throw error
    }
  }

  async deleteDetector(policyName, authToken) {
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
      console.error(`${TAGS.API} Getting policy ${policyName}...`)
      const getResponse = await callWithRetry(() => client.policies.get({ name: policyName }), 'policies.get')
      const policy = getResponse.data

      if (validationFn(policy)) {
        console.error(`${TAGS.API} Deleting ${typeDisplay} policy ${policyName}...`)
        const deleteResponse = await callWithRetry(
          () => client.policies.delete({ name: policyName }),
          'policies.delete',
        )
        console.error(`${TAGS.API} ✓ Successfully deleted ${typeDisplay} policy ${policyName}`)
        return deleteResponse.data
      } else {
        throw new Error(`Policy ${policyName} is not a ${typeDisplay}.`)
      }
    } catch (error) {
      console.error(`${TAGS.API} ✗ Error deleting ${typeDisplay} policy:`, error)
      throw error
    }
  }
}
