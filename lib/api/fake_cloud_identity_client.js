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
 * @fileoverview Fake implementation of the CloudIdentityClient interface for testing.
 */
import axios from 'axios'
import { CloudIdentityClient } from './interfaces/cloud_identity_client.js'
import { TAGS, CLOUD_IDENTITY_SETTING_TYPES, CLOUD_IDENTITY_FILTERS } from '../constants.js'
import { URL } from 'url'

export class FakeCloudIdentityClient extends CloudIdentityClient {
  constructor(rootUrl) {
    super()
    this.rootUrl = rootUrl
  }

  async listDlpRules(authToken) {
    return this._listPolicies(CLOUD_IDENTITY_FILTERS.DLP_RULE, authToken)
  }

  async listDetectors(authToken) {
    return this._listPolicies(CLOUD_IDENTITY_FILTERS.DETECTOR, authToken)
  }

  async _listPolicies(filter, authToken) {
    const url = new URL(`/v1beta1/policies`, this.rootUrl).href
    console.log(`${TAGS.API} [FAKE] GET ${url} with filter ${filter}`)
    const response = await axios.get(url, { params: { filter } })
    return response.data.policies
  }

  async createDlpRule(customerId, orgUnitId, ruleConfig, validateOnly = false, authToken) {
    const url = new URL(`/v1beta1/customers/${customerId}/policies`, this.rootUrl).href
    console.log(`${TAGS.API} [FAKE] POST ${url}`)
    const requestBody = {
      customer: `customers/${customerId}`,
      policyQuery: {
        query: `entity.org_units.exists(org_unit, org_unit.org_unit_id == orgUnitId('${orgUnitId}'))`,
      },
      setting: { type: CLOUD_IDENTITY_SETTING_TYPES.DLP_RULE, value: ruleConfig },
    }
    const response = await axios.post(url, requestBody)
    return response.data
  }

  async deleteDlpRule(policyName, authToken) {
    const url = new URL(`/v1beta1/${policyName}`, this.rootUrl).href
    console.log(`${TAGS.API} [FAKE] DELETE ${url}`)
    const response = await axios.delete(url)
    return response.data
  }

  async createDetector(customerId, orgUnitId, detectorConfig, authToken) {
    const url = new URL(`/v1beta1/customers/${customerId}/policies`, this.rootUrl).href
    console.log(`${TAGS.API} [FAKE] POST ${url}`)

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

  async deleteDetector(policyName, authToken) {
    const url = new URL(`/v1beta1/${policyName}`, this.rootUrl).href
    console.log(`${TAGS.API} [FAKE] DELETE ${url}`)
    const response = await axios.delete(url)
    return response.data
  }
}
