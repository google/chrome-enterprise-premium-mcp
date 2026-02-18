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

    async getConnectorPolicy(customerId, orgUnitId, policySchemaFilter, progressCallback, authToken) {
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
