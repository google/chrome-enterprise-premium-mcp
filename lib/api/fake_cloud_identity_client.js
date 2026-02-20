/**
 * @fileoverview Fake implementation of the CloudIdentityClient interface for testing.
 */
import axios from 'axios'
import { CloudIdentityClient } from './interfaces/cloud_identity_client.js'
import { TAGS } from '../constants.js'
import { URL } from 'url'

export class FakeCloudIdentityClient extends CloudIdentityClient {
  constructor(rootUrl) {
    super()
    this.rootUrl = rootUrl
  }

  async listDlpPolicies(type, authToken) {
    const url = new URL(`/v1beta1/policies`, this.rootUrl).href
    let filter = ''
    if (type === 'rule') {
      filter = 'setting.type.matches("rule.dlp")'
    } else if (type === 'detector') {
      filter = 'setting.type.matches("detector")'
    }
    console.log(`${TAGS.API} [FAKE] GET ${url} with filter ${filter}`)
    const response = await axios.get(url, { params: { filter } })
    return response.data.policies
  }

  async createDlpRule(customerId, orgUnitId, ruleConfig, validateOnly = false, authToken) {
    const url = new URL(`/v1beta1/customers/${customerId}/policies`, this.rootUrl).href
    console.log(`${TAGS.API} [FAKE] POST ${url}`)
    const requestBody = {
      customer: `customers/${customerId}`,
      policyQuery: { orgUnit: `orgUnits/${orgUnitId}` },
      setting: { type: 'settings/rule.dlp', value: ruleConfig },
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

  async createUrlList(customerId, orgUnitId, urlListConfig, authToken) {
    const url = new URL(`/v1beta1/customers/${customerId}/policies`, this.rootUrl).href
    console.log(`${TAGS.API} [FAKE] POST ${url}`)
    const requestBody = {
      customer: `customers/${customerId}`,
      policyQuery: { orgUnit: `orgUnits/${orgUnitId}` },
      setting: { type: 'settings/detector.url_list', value: urlListConfig },
      type: 'ADMIN',
    }
    const response = await axios.post(url, requestBody)
    return response.data
  }
}
