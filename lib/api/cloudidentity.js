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
 * @fileoverview Google Cloud Identity API client wrapper.
 *
 * Provides functions to:
 * - Manage Data Loss Prevention (DLP) rules.
 * - Manage URL blocking lists.
 */

import { google } from 'googleapis'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry } from '../util/helpers.js'
import { SCOPES, API_VERSIONS, TAGS, CHROME_DLP_TRIGGERS } from '../constants.js'

/**
 * Initializes or returns the cached Cloud Identity API client.
 *
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions={}] - Options for API client creation
 * @returns {Promise<object>} The Cloud Identity API client instance
 */
async function getPolicyClient(authToken, apiOptions) {
  return createApiClient(
    google.cloudidentity,
    API_VERSIONS.CLOUD_IDENTITY,
    [SCOPES.CLOUD_IDENTITY_POLICIES],
    authToken,
    apiOptions,
  )
}

/**
 * Lists DLP rules or detectors for a given customer.
 *
 * Automatically paginates to retrieve all policies.
 *
 * @param {string} type - The policy type to filter ('rule' or 'detector')
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions={}] - Options for API client creation
 * @returns {Promise<Array<object>>} A promise that resolves to a list of policies
 * @throws {Error} If the API call fails
 */
export async function listDlpPolicies(type, authToken, apiOptions = {}) {
  const client = await getPolicyClient(authToken, apiOptions)

  try {
    console.error(`${TAGS.API} Listing DLP policies...`)

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

/**
 * Creates a new Chrome DLP Rule for a specific Organizational Unit.
 * @param {string} customerId - The Chrome customer ID
 * @param {string} orgUnitId - The target Organizational Unit ID
 * @param {object} ruleConfig - Configuration for the DLP rule
 * @param {string} ruleConfig.displayName - Name of the rule
 * @param {string} [ruleConfig.description] - Description of the rule
 * @param {string[]} ruleConfig.triggers - Array of trigger strings (e.g. "google.workspace.chrome.file.v1.download")
 * @param {string} ruleConfig.condition - CEL string for the content condition
 * @param {object} ruleConfig.action - Action object (e.g. { chromeAction: { warnUser: {} } })
 * @param {string} [ruleConfig.state='ACTIVE'] - "ACTIVE" or "INACTIVE"
 * @param {boolean} [validateOnly=false] - If true, validates the request without creating the rule
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions={}] - Options for API client creation
 * @returns {Promise<object>} A promise that resolves to the created policy object
 */
export async function createDlpRule(
  customerId,
  orgUnitId,
  ruleConfig,
  validateOnly = false,
  authToken,
  apiOptions = {},
) {
  const client = await getPolicyClient(authToken, apiOptions)
  // ... rest of the function logic (as before)
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
          value: {
            display_name: ruleConfig.displayName,
            description: ruleConfig.description || '',
            state: ruleConfig.state || 'ACTIVE',
            triggers: ruleConfig.triggers,
            condition: {
              contentCondition: ruleConfig.condition,
            },
            action: ruleConfig.action,
          },
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

/**
 * Creates a new URL blocking list.
 * @param {string} customerId - The Chrome customer ID
 * @param {string} orgUnitId - The target Organizational Unit ID
 * @param {object} urlListConfig - Configuration for the URL list
 * @param {string} urlListConfig.display_name - Display name for the list
 * @param {string[]} urlListConfig.urls - Array of URLs to include
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions={}] - Options for API client creation
 * @returns {Promise<object>} A promise that resolves to the created policy object
 */
export async function createUrlList(customerId, orgUnitId, urlListConfig, authToken, apiOptions = {}) {
  const client = await getPolicyClient(authToken, apiOptions)
  // ... rest of the function logic (as before)
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
          value: {
            display_name: urlListConfig.display_name,
            urlList: {
              urls: urlListConfig.urls,
            },
          },
        },
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

/**
 * Deletes a DLP policy if it is identified as a Chrome DLP rule.
 * @param {string} policyName - The resource name of the policy to delete
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions={}] - Options for API client creation
 * @returns {Promise<object>} A promise that resolves to the deletion response
 * @throws {Error} If the policy is not a Chrome DLP rule or the API call fails
 */
export async function deleteDlpRule(policyName, authToken, apiOptions = {}) {
  const client = await getPolicyClient(authToken, apiOptions)
  // ... rest of the function logic (as before)
  try {
    console.error(`${TAGS.API} Getting DLP policy ${policyName}...`)
    const getResponse = await callWithRetry(() => client.policies.get({ name: policyName }), 'policies.get')
    const policy = getResponse.data
    const triggers = policy.setting.value.triggers || []
    const chromeTriggers = Object.values(CHROME_DLP_TRIGGERS)
    const isChromeDlpRule = triggers.some(trigger => chromeTriggers.includes(trigger))

    if (isChromeDlpRule) {
      console.error(`${TAGS.API} Deleting DLP policy ${policyName}...`)
      const deleteResponse = await callWithRetry(() => client.policies.delete({ name: policyName }), 'policies.delete')
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
