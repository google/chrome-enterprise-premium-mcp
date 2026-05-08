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
import { formatToolResponse, ApiClients, SessionState, McpToolResponse } from './wrapper.js'
import { CloudIdentityClient } from '../../lib/api/cloud_identity_client.js'
import { isObject, getString } from '../../lib/util/helpers.js'

/**
 * Helper to create a detector and format the response.
 * @param apiClients The API clients collection.
 * @param cloudIdentityClient The Cloud Identity client instance.
 * @param customerId The customer ID.
 * @param authToken The authentication token.
 * @param sessionState The session state object.
 * @param detectorConfig The detector configuration object.
 * @param detectorTypeString A string describing the type of detector (e.g. 'URL list').
 * @returns The formatted MCP tool response.
 */
export async function createDetectorAndFormatResponse(
  apiClients: ApiClients,
  cloudIdentityClient: CloudIdentityClient,
  customerId: string,
  authToken: string,
  sessionState: SessionState,
  detectorConfig: Record<string, unknown>,
  detectorTypeString: string,
): Promise<McpToolResponse> {
  const orgUnitId = await resolveRootOrgUnitId(apiClients, customerId, authToken, sessionState)
  if (!orgUnitId) {
    throw new Error('Failed to resolve root organizational unit ID.')
  }

  const result = await cloudIdentityClient.createDetector(customerId, orgUnitId, detectorConfig, authToken)
  const createdPolicy = result

  const setting = createdPolicy.setting
  const settingValue = setting?.value
  const configDisplayName = getString(detectorConfig, 'displayName') || ''
  const createdDisplayName =
    settingValue && isObject(settingValue)
      ? getString(settingValue, 'displayName') || configDisplayName
      : configDisplayName

  const name = createdPolicy.name || ''

  return formatToolResponse({
    summary: `Successfully created ${detectorTypeString} detector "${createdDisplayName}".\nResource name: \`${name}\``,
    data: { detector: createdPolicy },
    structuredContent: { detector: createdPolicy },
  })
}
