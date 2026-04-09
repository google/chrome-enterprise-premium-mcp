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
 * @fileoverview Shared utilities for MCP tools.
 *
 * Provides helper functions for:
 * - Handling GCP authentication tokens.
 * - Wrapping tools with common logic (e.g., customer ID resolution).
 * - Validating organizational unit IDs.
 */

import { z } from 'zod'

import { SERVICE_NAMES, TAGS } from '../lib/constants.js'
export const inputSchemas = {
  customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
  userId: z.string().describe("The user's primary email address or unique ID."),
  orgUnitId: z.string().describe('The ID of the organizational unit.'),
  orgUnitIdOptional: z.string().optional().describe('The ID of the organizational unit to filter results.'),
  projectId: z.string().describe('The Google Cloud project ID or number.'),
  policyName: z
    .string()
    .startsWith('policies/')
    .describe('The resource name of the policy (e.g. policies/akajj264apk5psphei)'),
  detectorResourceName: z
    .string()
    .startsWith('policies/')
    .describe('The resource name of the detector (e.g. policies/akajj264apk5psphei)'),
  ruleResourceName: z
    .string()
    .startsWith('policies/')
    .describe('The resource name of the DLP rule (e.g. policies/ajjs664skp992kska)'),
  apiName: z
    .enum(Object.values(SERVICE_NAMES))
    .optional()
    .describe('The API name to check/enable (e.g., admin.googleapis.com).'),
  enable: z.boolean().optional().describe('Whether to enable the API if it is disabled.'),
  checkAll: z.boolean().optional().describe('Whether to check all required APIs and enable the missing ones.'),
}

/**
 * Reusable Zod schema definitions for outputs.
 */
export const outputSchemas = {
  // Generic operation outcome schema
  operationOutcome: z.object({
    status: z.string().optional().default('SUCCESS'),
    message: z.string().optional().default('Operation completed successfully.'),
  }),
  entityList: z
    .union([z.object({ entities: z.array(z.record(z.any())) }), z.any()])
    .optional()
    .default([]),
  orgUnits: z
    .union([z.array(z.object({ name: z.string(), orgUnitPath: z.string() }).passthrough()), z.any()])
    .optional()
    .default([]),
  customerProfiles: z.array(z.any()).optional().default([]),
  counts: z.array(z.any()).optional().default([]),
  activityLogs: z.array(z.any()).optional().default([]),
  subscriptionInfo: z
    .union([
      z
        .object({
          isActive: z.boolean().describe('Whether the subscription or license is active.'),
          assignmentCount: z.number().optional().describe('Number of license assignments.'),
        })
        .passthrough(),
      z.any(),
    ])
    .optional(),
  extensionStatus: z
    .union([
      z
        .object({
          isInstalled: z.boolean().describe('Whether the extension is force-installed.'),
          extensionId: z.string().optional().describe('The ID of the extension.'),
        })
        .passthrough(),
      z.any(),
    ])
    .optional(),
  connectorPolicy: z.any().optional().describe('Structured configuration for a connector policy.'),
  knowledgeSearch: z.array(z.any()).optional().default([]),
  knowledgeDocument: z
    .union([
      z.object({
        title: z.string(),
        content: z.string(),
        metadata: z.any().optional(),
      }),
      z.any(),
    ])
    .optional(),
}

/**
 * Extracts the authentication token from the request headers.
 *
 * @param {object} requestInfo - The request context object
 * @returns {string|null} The Bearer token if present, otherwise null
 */
