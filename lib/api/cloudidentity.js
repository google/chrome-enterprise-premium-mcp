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
 * @file Google Cloud Identity API client wrapper.
 *
 * Provides functions to:
 * - Manage Data Loss Prevention (DLP) rules.
 * - Manage URL blocking lists.
 */

import { google } from 'googleapis'
import { logger } from '../util/logger.js'
import { createApiClient } from '../util/api-client.js'
import { callWithRetry } from '../util/helpers.js'
import {
  SCOPES,
  API_VERSIONS,
  TAGS,
  CLOUD_IDENTITY_SETTING_TYPES,
  CLOUD_IDENTITY_FILTERS,
  POLICY_TYPES,
} from '../constants.js'
import { POLICY_STATES, CHROME_TRIGGERS } from '../util/chrome_dlp_constants.js'

/**
 * Initializes or returns the cached Cloud Identity API client.
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<object>} The Cloud Identity API client instance
 * @throws {Error} If the API client creation fails
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
 * Lists all Chrome DLP rules for the customer.
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<Array<object>>} A list of DLP rules
 * @throws {Error} If the API call fails
 */
export async function listDlpRules(authToken, apiOptions = {}) {
  return listDlpPolicies(POLICY_TYPES.RULE, authToken, apiOptions)
}

/**
 * Lists all Chrome DLP detectors for the customer.
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<Array<object>>} A list of detectors
 * @throws {Error} If the API call fails
 */
export async function listDetectors(authToken, apiOptions = {}) {
  return listDlpPolicies(POLICY_TYPES.DETECTOR, authToken, apiOptions)
}

/**
 * Lists DLP policies of a specific type.
 * @param {string} type - The type of policy to list (RULE or DETECTOR)
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<Array<object>>} A list of policies
 * @throws {Error} If the API call fails
 */
export async function listDlpPolicies(type, authToken, apiOptions = {}) {
  const client = await getPolicyClient(authToken, apiOptions)
  try {
    logger.info(`${TAGS.API} Listing policies...`)
    let filter = ''
    if (type === POLICY_TYPES.RULE) {
      filter = CLOUD_IDENTITY_FILTERS.DLP_RULE
    } else if (type === POLICY_TYPES.DETECTOR) {
      filter = CLOUD_IDENTITY_FILTERS.DETECTOR
    }

    let nextPageToken
    const allPolicies = []
    do {
      const request = { filter, pageSize: 50, pageToken: nextPageToken }
      const response = await callWithRetry(() => client.policies.list(request), 'policies.list')
      if (response.data.policies) {
        allPolicies.push(...response.data.policies)
      }
      nextPageToken = response.data.nextPageToken
    } while (nextPageToken)
    return allPolicies
  } catch (error) {
    logger.error(`${TAGS.API} ✗ Error listing policies:`, error)
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
 * @param {string} [ruleConfig.state] - "ACTIVE" or "INACTIVE"
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<object>} A promise that resolves to the created policy object
 * @throws {Error} If the API call fails
 */
export async function createDlpRule(customerId, orgUnitId, ruleConfig, authToken, apiOptions = {}) {
  const client = await getPolicyClient(authToken, apiOptions)
  try {
    const request = {
      requestBody: {
        customer: `customers/${customerId}`,
        policyQuery: {
          query: `entity.org_units.exists(org_unit, org_unit.org_unit_id == orgUnitId('${orgUnitId}'))`,
        },
        setting: {
          type: CLOUD_IDENTITY_SETTING_TYPES.DLP_RULE,
          value: {
            display_name: ruleConfig.displayName,
            description: ruleConfig.description || '',
            state: ruleConfig.state || POLICY_STATES.ACTIVE.value,
            triggers: ruleConfig.triggers,
            condition: { contentCondition: ruleConfig.condition },
            action: ruleConfig.action,
          },
        },
      },
    }
    const response = await callWithRetry(() => client.policies.create(request), 'policies.create')
    return response.data
  } catch (error) {
    logger.error(`${TAGS.API} ✗ Error creating DLP rule:`, error)
    throw error
  }
}

/**
 * Deletes a Chrome DLP rule with validation to ensure it's a Chrome rule.
 * @param {string} policyName - The resource name of the policy to delete
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<object>} The deleted policy response
 * @throws {Error} If validation fails or deletion fails
 */
export async function deleteDlpRule(policyName, authToken, apiOptions = {}) {
  return deletePolicyWithValidation(
    policyName,
    policy => {
      const triggers = policy.setting?.value?.triggers || []
      const chromeTriggers = Object.values(CHROME_TRIGGERS).map(t => t.value)
      return triggers.some(trigger => chromeTriggers.includes(trigger))
    },
    'Chrome DLP rule',
    authToken,
    apiOptions,
  )
}

/**
 * Creates a new DLP detector for a specific Organizational Unit.
 * @param {string} customerId - The Chrome customer ID
 * @param {string} orgUnitId - The target Organizational Unit ID
 * @param {object} detectorConfig - Configuration for the detector
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<object>} A promise that resolves to the created detector object
 * @throws {Error} If the API call fails
 */
export async function createDetector(customerId, orgUnitId, detectorConfig, authToken, apiOptions = {}) {
  const client = await getPolicyClient(authToken, apiOptions)
  try {
    let detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR
    if (detectorConfig.urlList) {
      detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR_URL_LIST
    } else if (detectorConfig.wordList) {
      detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR_WORD_LIST
    } else if (detectorConfig.regularExpression) {
      detectorType = CLOUD_IDENTITY_SETTING_TYPES.DETECTOR_REGEX
    }

    const request = {
      requestBody: {
        customer: `customers/${customerId}`,
        policyQuery: {
          query: `entity.org_units.exists(org_unit, org_unit.org_unit_id == orgUnitId('${orgUnitId}'))`,
        },
        setting: { type: detectorType, value: detectorConfig },
        type: 'ADMIN',
      },
    }
    const response = await callWithRetry(() => client.policies.create(request), 'policies.create')
    return response.data
  } catch (error) {
    logger.error(`${TAGS.API} ✗ Error creating detector:`, error)
    throw error
  }
}

/**
 * Deletes a DLP detector with validation to ensure it's a detector.
 * @param {string} policyName - The resource name of the policy to delete
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<object>} The deleted policy response
 * @throws {Error} If validation fails or deletion fails
 */
export async function deleteDetector(policyName, authToken, apiOptions = {}) {
  return deletePolicyWithValidation(
    policyName,
    policy => policy.setting?.type?.includes('detector'),
    'DLP Detector',
    authToken,
    apiOptions,
  )
}

/**
 * Helper to delete a policy with custom validation logic.
 * @param {string} policyName - The resource name of the policy to delete
 * @param {function(object): boolean} validationFn - Function to validate the policy before deletion
 * @param {string} typeDisplay - Human-readable type name for error messages
 * @param {string} [authToken] - Optional OAuth token
 * @param {object} [apiOptions] - Options for API client creation
 * @returns {Promise<object>} The deleted policy response
 * @throws {Error} If validation fails or deletion fails
 */
async function deletePolicyWithValidation(policyName, validationFn, typeDisplay, authToken, apiOptions) {
  const client = await getPolicyClient(authToken, apiOptions)
  try {
    const getResponse = await callWithRetry(() => client.policies.get({ name: policyName }), 'policies.get')
    if (validationFn(getResponse.data)) {
      const deleteResponse = await callWithRetry(() => client.policies.delete({ name: policyName }), 'policies.delete')
      return deleteResponse.data
    } else {
      throw new Error(`Policy ${policyName} is not a ${typeDisplay}.`)
    }
  } catch (error) {
    logger.error(`${TAGS.API} ✗ Error deleting ${typeDisplay}:`, error)
    throw error
  }
}
