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

    async listDlpPolicies(type, authToken, customerId) {
        if (!customerId) {
            throw new Error('customerId is required for listDlpPolicies')
        }
        const client = await this.getPolicyClient(authToken)
        try {
            console.error(`${TAGS.API} Listing DLP policies for customer ${customerId}...`)
            let filter = ''
            if (type === 'rule') {
                filter = 'setting.type.matches("rule.dlp")'
            } else if (type === 'detector') {
                filter = 'setting.type.matches("detector")'
            }

            let nextPageToken
            const allPolicies = []
            do {
                const request = {
                    filter,
                    pageSize: 50,
                    pageToken: nextPageToken,
                    parent: `customers/${customerId}`,
                }
                const response = await callWithRetry(() => client.policies.list(request), 'policies.list')
                if (response.data.policies) {
                    allPolicies.push(...response.data.policies)
                }
                nextPageToken = response.data.nextPageToken
            } while (nextPageToken)
            return allPolicies
        } catch (error) {
            console.error(`${TAGS.API} ✗ Error listing DLP policies:`, error)
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
        const client = await this.getPolicyClient(authToken)
        try {
            console.error(`${TAGS.API} Getting DLP policy ${policyName}...`)
            const getResponse = await callWithRetry(() => client.policies.get({ name: policyName }), 'policies.get')
            const policy = getResponse.data
            const triggers = policy.setting.value.triggers || []
            const chromeTriggers = Object.values(CHROME_DLP_TRIGGERS)
            const isChromeDlpRule = triggers.some(trigger => chromeTriggers.includes(trigger))

            if (isChromeDlpRule) {
                console.error(`${TAGS.API} Deleting DLP policy ${policyName}...`)
                const deleteResponse = await callWithRetry(
                    () => client.policies.delete({ name: policyName }),
                    'policies.delete',
                )
                console.error(`${TAGS.API} ✓ Successfully deleted DLP policy ${policyName}`)
                return deleteResponse.data
            } else {
                throw new Error(`Policy ${policyName} is not a Chrome DLP rule.`)
            }
        } catch (error) {
            console.error(`${TAGS.API} ✗ Error deleting DLP policy:`, error)
            throw error
        }
    }

    async createUrlList(customerId, orgUnitId, urlListConfig, authToken) {
        const client = await this.getPolicyClient(authToken)
        try {
            const message = `Creating URL List for customer ${customerId} in OU ${orgUnitId}...`
            console.error(`${TAGS.API} ${message}`)
            const request = {
                requestBody: {
                    customer: `customers/${customerId}`,
                    policyQuery: {
                        query: `entity.org_units.exists(org_unit, org_unit.org_unit_id == orgUnitId('${orgUnitId}'))`,
                    },
                    setting: {
                        type: 'settings/detector.url_list',
                        value: urlListConfig,
                    },
                    type: 'ADMIN',
                },
            }
            const response = await callWithRetry(() => client.policies.create(request), 'policies.create')
            console.error(`${TAGS.API} ✓ Successfully created URL list: ${response.data.name}`)
            return response.data
        } catch (error) {
            console.error(`${TAGS.API} ✗ Error creating URL list:`, error)
            if (error.response?.data?.error) {
                const { code, message, status } = error.response.data.error
                throw new Error(`API Error ${code} (${status}): ${message}`)
            }
            throw error
        }
    }
}
