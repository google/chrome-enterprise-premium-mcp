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
 * @file Shared utilities for DLP detectors.
 */

import { resolveRootOrgUnitId } from './org-unit.js'
import { formatToolResponse } from './wrapper.js'

/**
 * Helper to create a detector and format the response.
 * @param {object} apiClients - The API clients collection.
 * @param {import('../../lib/api/interfaces/cloud_identity_client.js').CloudIdentityClient} cloudIdentityClient - The Cloud Identity client instance.
 * @param {string} customerId - The customer ID.
 * @param {string} authToken - The authentication token.
 * @param {object} sessionState - The session state object.
 * @param {object} detectorConfig - The detector configuration object.
 * @param {string} detectorTypeString - A string describing the type of detector (e.g. 'URL list').
 * @returns {Promise<object>} The formatted MCP tool response.
 */
export async function createDetectorAndFormatResponse(
  apiClients,
  cloudIdentityClient,
  customerId,
  authToken,
  sessionState,
  detectorConfig,
  detectorTypeString,
) {
  const orgUnitId = await resolveRootOrgUnitId(apiClients, customerId, authToken, sessionState)
  if (!orgUnitId) {
    throw new Error('Failed to resolve root organizational unit ID.')
  }

  const result = await cloudIdentityClient.createDetector(customerId, orgUnitId, detectorConfig, authToken)
  const createdPolicy = result.response
  const createdDisplayName = createdPolicy?.setting?.value?.displayName || detectorConfig.displayName

  return formatToolResponse({
    summary: `Successfully created ${detectorTypeString} detector "${createdDisplayName}".\nResource name: \`${createdPolicy.name}\``,
    data: { detector: createdPolicy },
    structuredContent: { detector: createdPolicy },
  })
}
