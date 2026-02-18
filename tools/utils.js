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
 * Sets the global cached Customer ID.
 *
 * @param {string} id - The customer ID to cache
 */
export function setGlobalCustomerId(id) {
    cachedCustomerId = id
}

/**
 * Reusable Zod schema definitions.
 */
export const commonSchemas = {
    customerId: z.string().optional().describe('The Chrome customer ID (e.g. C012345)'),
    orgUnitId: z.string().describe('The ID of the organizational unit.'),
    orgUnitIdOptional: z.string().optional().describe('The ID of the organizational unit to filter results.'),
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
 * Implements the guardrail model for write operations.
 *
 * @param {object} definition - The tool definition object.
 * @param {Function} definition.validate - The validation function.
 * @param {Function} definition.transform - The transformation function.
 * @param {Function} definition.handler - The handler function.
 * @param {boolean} [definition.skipAutoResolve=false] - Whether to skip customer ID auto-resolve.
 * @param {object} [apiOptions={}] - API client options including rootUrl.
 * @returns {Function} The wrapped tool function.
 */
function commonTransform(params) {
    const newParams = { ...params }
    if (newParams.orgUnitId) {
        newParams.orgUnitId = validateAndGetOrgUnitId(newParams.orgUnitId)
    }
    return newParams
}

export function guardedToolCall({ validate, transform, handler, skipAutoResolve = false }, options = {}) {
    return async (params, context) => {
        try {
            const { apiClients } = options
            let currentParams = { ...params }
            if (currentParams.customerId) {
                setGlobalCustomerId(currentParams.customerId)
            }

            if (!skipAutoResolve && currentParams.customerId === undefined) {
                if (cachedCustomerId) {
                    currentParams.customerId = cachedCustomerId
                } else {
                    try {
                        const authToken = getAuthToken(context?.requestInfo)
                        if (apiClients && apiClients.adminSdk) {
                            const customer = await apiClients.adminSdk.getCustomerId(authToken)

                            if (customer && customer.id) {
                                setGlobalCustomerId(customer.id)
                                currentParams.customerId = customer.id
                            } else {
                                console.error(
                                    `${TAGS.MCP} ⚠️ Failed to auto-resolve customerId: No customer object returned.`,
                                )
                            }
                        } else {
                            console.error(`${TAGS.MCP} ⚠️ adminSdkClient not provided to guardedToolCall`)
                        }
                    } catch (error) {
                        console.error(`${TAGS.MCP} ⚠️ Failed to auto-resolve customerId:`, error.message)
                    }
                }
            }

            // 1. COMMON TRANSFORMATION
            let transformedParams = commonTransform(currentParams)

            // 2. CUSTOM TRANSFORMATION
            if (transform) {
                transformedParams = transform(transformedParams)
            }

            // 3. VALIDATION
            if (validate) {
                validate(transformedParams)
            }

            // 4. EXECUTION
            return await handler(transformedParams, context)
        } catch (error) {
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
            }
        }
    }
}

/**
 * Validates and normalizes an Organizational Unit ID.
 *
 * Strips the 'id:' prefix if present.
 *
 * @param {string} orgUnitId - The raw Organizational Unit ID
 * @returns {string} The normalized ID
 */
export function validateAndGetOrgUnitId(orgUnitId) {
    if (typeof orgUnitId === 'string' && orgUnitId.startsWith('id:')) {
        return orgUnitId.substring(3)
    }
    return orgUnitId
}
