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

import { TAGS } from '../lib/constants.js'

let cachedCustomerId = null

/**
 * Resets the cached customer ID and root organizational unit ID.
 * Primarily used for testing to ensure a clean state.
 */
export function resetCache() {
  cachedCustomerId = null
}

/**
 * Reusable Zod schema definitions for inputs.
 */
export const inputSchemas = {
  customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
  orgUnitId: z.string().describe('The ID of the organizational unit.'),
  orgUnitIdOptional: z.string().optional().describe('The ID of the organizational unit to filter results.'),
}

/**
 * Reusable Zod schema definitions for outputs.
 */
export const outputSchemas = {
  // Generic success message
  successMessage: z.object({
    content: z.array(
      z.object({
        type: z.literal('text'),
        text: z.string(),
      }),
    ),
  }),
  // List of policies (rules or detectors)
  policyList: z.object({
    content: z.array(
      z.object({
        type: z.literal('text'),
        text: z.string().describe('A JSON-formatted string containing the list of policies.'),
      }),
    ),
  }),
  // Single policy (created or retrieved)
  singlePolicy: z.object({
    content: z.array(
      z.object({
        type: z.literal('text'),
        text: z.string().describe('A JSON-formatted string containing the policy details.'),
      }),
    ),
  }),
}

/**
 * Extracts the authentication token from the request headers.
 *
 * @param {object} requestInfo - The request context object
 * @returns {string|null} The Bearer token if present, otherwise null
 */
export function getAuthToken(requestInfo) {
  return requestInfo?.headers?.authorization ? requestInfo.headers.authorization.split(' ')[1] : null
}

/**
 * Helper to wrap tool handlers with common logic like customerId resolution
 * and error handling.
 *
 * @param {object} toolDef
 * @param {Function} [toolDef.validate] - Optional validation function
 * @param {Function} [toolDef.transform] - Optional parameter transformation function
 * @param {Function} toolDef.handler - The main tool handler function
 * @param {boolean} [toolDef.skipAutoResolve] - Whether to skip auto-resolving customerId
 * @param {object} options
 * @returns {Function} Wrapped tool handler
 */
export function guardedToolCall({ validate, transform, handler, skipAutoResolve = false }, options = {}) {
  return async (params, context) => {
    try {
      const { apiClients, apiOptions } = options
      let currentParams = { ...params }
      if (currentParams.customerId) {
        cachedCustomerId = currentParams.customerId
      }

      if (!skipAutoResolve && currentParams.customerId === undefined) {
        if (cachedCustomerId) {
          currentParams.customerId = cachedCustomerId
        } else {
          try {
            const authToken = getAuthToken(context?.requestInfo)
            if (apiClients && apiClients.adminSdk) {
              const customer = await apiClients.adminSdk.getCustomerId(authToken, apiOptions)
              if (customer && customer.id) {
                cachedCustomerId = customer.id
                currentParams.customerId = customer.id
              } else {
                console.error(`${TAGS.MCP} ⚠️ Failed to auto-resolve customerId: No customer object returned.`)
              }
            } else {
              console.error(`${TAGS.MCP} ⚠️ adminSdkClient not provided to guardedToolCall`)
            }
          } catch (error) {
            console.error(`${TAGS.MCP} ⚠️ Failed to auto-resolve customerId:`, error.message)
          }
        }
      }

      let transformedParams = commonTransform(currentParams)
      if (transform) {
        transformedParams = transform(transformedParams)
      }
      if (validate) {
        validate(transformedParams)
      }

      const result = await handler(transformedParams, context)
      if (result && !result.structuredContent && result.content) {
        result.structuredContent = { content: result.content }
      }
      return result
    } catch (error) {
      console.error(`${TAGS.MCP} Tool handler error:`, error)
      const status = error.status || error.code || error.response?.status
      if (status === 401) {
        throw {
          status: 401,
          message: 'Authentication required. Please check your credentials.',
        }
      } else if (status === 403) {
        throw {
          status: 403,
          message: 'Permission denied. Your account lacks the required permissions.',
        }
      }
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      }
    }
  }
}

/**
 * Performs common transformations on tool parameters.
 *
 * @param {object} params
 * @returns {object} Transformed parameters
 */
export function commonTransform(params) {
  const newParams = { ...params }
  if (newParams.orgUnitId) {
    newParams.orgUnitId = validateAndGetOrgUnitId(newParams.orgUnitId)
  }
  return newParams
}

/**
 * Validates and extracts the raw organizational unit ID.
 *
 * @param {string} orgUnitId
 * @returns {string} The raw ID
 */
export function validateAndGetOrgUnitId(orgUnitId) {
  if (typeof orgUnitId === 'string' && orgUnitId.startsWith('id:')) {
    return orgUnitId.substring(3)
  }
  return orgUnitId
}
