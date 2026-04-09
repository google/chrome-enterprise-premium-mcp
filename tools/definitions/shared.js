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

import { z } from 'zod'
import { WORKSPACE_RULE_LIMITS } from '../../lib/util/chrome_dlp_constants.js'

/**
 * Shared input schemas for MCP tools.
 */
export const commonInputSchemas = {
  customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
  orgUnitId: z.string().describe('The ID of the organizational unit.'),
  userId: z.string().describe("The user's primary email address or unique ID."),
  detectorDisplayName: z
    .string()
    .max(WORKSPACE_RULE_LIMITS.NAME_MAX_LENGTH)
    .describe('The display name for the detector.'),
  detectorDescription: z
    .string()
    .max(WORKSPACE_RULE_LIMITS.DESCRIPTION_MAX_LENGTH)
    .optional()
    .describe('An optional description for the detector.'),
}
