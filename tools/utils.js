/**
 * @fileoverview Shared utilities for MCP tools.
 *
 * Provides helper functions for:
 * - Handling GCP authentication tokens.
 * - Wrapping tools with common logic (e.g., customer ID resolution).
 * - Validating organizational unit IDs.
 */

import { z } from 'zod';

import { getCustomerId } from '../lib/api/admin_sdk.js';
import { TAGS } from '../lib/constants.js';

let cachedCustomerId = null;


/**
 * Sets the global cached Customer ID.
 *
 * @param {string} id - The customer ID to cache
 */
export function setGlobalCustomerId(id) {
  cachedCustomerId = id;
}


/**
 * Reusable Zod schema definitions.
 */
export const commonSchemas = {
  customerId: z
    .string()
    .optional()
    .describe('The Chrome customer ID (e.g. C012345)'),
  orgUnitId: z
    .string()
    .describe('The ID of the organizational unit.'),
  orgUnitIdOptional: z
    .string()
    .optional()
    .describe('The ID of the organizational unit to filter results.'),
};


/**
 * Extracts the authentication token from the request headers.
 *
 * @param {object} requestInfo - The request context object
 * @returns {string|null} The Bearer token if present, otherwise null
 */
export function getAuthToken(requestInfo) {
  return requestInfo?.headers?.authorization
    ? requestInfo.headers.authorization.split(' ')[1]
    : null;
}


/**
 * Wraps a tool implementation with common GCP logic.
 *
 * Automatically resolves the `customerId` if it's missing or set to 'me',
 * unless `skipAutoResolve` is true. Caches the resolved ID for future calls.
 *
 * @param {boolean} gcpCredentialsAvailable - Whether GCP credentials are available (unused, kept for signature compatibility)
 * @param {Function} fn - The tool implementation function
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.skipAutoResolve=false] - If true, skips automatic customer ID resolution
 * @returns {Function} The wrapped tool function
 */
export function gcpTool(gcpCredentialsAvailable, fn, options = {}) {
  return async (args, context) => {
    // Attempt to auto-resolve customerId if applicable
    const shouldResolve =
      !options.skipAutoResolve &&
      args &&
      (args.customerId === undefined || args.customerId === 'me');

    if (shouldResolve) {
      if (cachedCustomerId) {
        args.customerId = cachedCustomerId;
      } else {
        try {
          const authToken = getAuthToken(context?.requestInfo);
          const customer = await getCustomerId(authToken);
          
          if (customer && customer.id) {
            cachedCustomerId = customer.id;
            args.customerId = cachedCustomerId;
          }
        } catch (error) {
          // Log but don't fail; the tool might validate the missing ID itself or work without it.
          console.error(`${TAGS.MCP} ⚠️ Failed to auto-resolve customerId:`, error.message);
        }
      }
    }

    return fn(args, context);
  };
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
    return orgUnitId.substring(3);
  }
  return orgUnitId;
}