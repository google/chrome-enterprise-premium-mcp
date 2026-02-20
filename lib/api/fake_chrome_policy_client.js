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
 * @fileoverview Fake implementation of the ChromePolicyClient interface for testing.
 */
import axios from 'axios'
import { ChromePolicyClient } from './interfaces/chrome_policy_client.js'
import { TAGS } from '../constants.js'
import { URL } from 'url'

export class FakeChromePolicyClient extends ChromePolicyClient {
  constructor(rootUrl) {
    super()
    this.rootUrl = rootUrl
  }

  async getConnectorPolicy(customerId, orgUnitId, policySchemaFilter, authToken) {
    const url = new URL(`/v1/customers/${customerId}/policies:resolve`, this.rootUrl).href
    console.log(`${TAGS.API} [FAKE] POST ${url}`)
    const requestBody = {
      policyTargetKey: { targetResource: `orgunits/${orgUnitId}` },
      policySchemaFilter,
    }
    const response = await axios.post(url, requestBody)
    return response.data.resolvedPolicies
  }
}
