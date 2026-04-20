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
 * @file Organizational Unit utilities for MCP tools.
 */

import { TAGS } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'

/**
 * Resolves the root organizational unit ID for the given customer.
 * Uses session caching to avoid redundant API calls.
 * @param {object} apiClients - The API clients object
 * @param {string} customerId - The customer ID
 * @param {string} authToken - The authentication token
 * @param {object} sessionState - The session state object for caching
 * @returns {Promise<string|null>} The root OU ID or null if resolution fails
 */
export async function resolveRootOrgUnitId(apiClients, customerId, authToken, sessionState) {
  if (sessionState.cachedRootOrgUnitId) {
    return sessionState.cachedRootOrgUnitId
  }

  try {
    if (apiClients && apiClients.adminSdk) {
      const orgUnitsResponse = await apiClients.adminSdk.listOrgUnits({ customerId }, authToken)
      const rootOU = orgUnitsResponse.organizationUnits?.find(ou => ou.orgUnitPath === '/')
      if (rootOU && rootOU.orgUnitId) {
        const id = rootOU.orgUnitId
        if (!sessionState.cachedRootOrgUnitId) {
          sessionState.cachedRootOrgUnitId = id
        }
        return id
      } else {
        logger.error(
          `${TAGS.MCP} ⚠️ Failed to auto-resolve root orgUnitId for customer ${customerId}: Root OU not found.`,
        )
      }
    } else {
      logger.error(`${TAGS.MCP} ⚠️ adminSdkClient not provided for OU resolution (customer: ${customerId})`)
    }
  } catch (error) {
    logger.error(`${TAGS.MCP} ⚠️ Failed to auto-resolve root orgUnitId for customer ${customerId}:`, error)
  }
  return null
}

/**
 * Validates and extracts the raw organizational unit ID.
 * @param {string} orgUnitId - The organizational unit ID to validate
 * @returns {string} The raw organizational unit ID
 */
export function validateAndGetOrgUnitId(orgUnitId) {
  if (typeof orgUnitId === 'string' && orgUnitId.startsWith('id:')) {
    return orgUnitId.substring(3)
  }
  return orgUnitId
}
