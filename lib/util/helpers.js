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
 * @file Helper functions for the Chrome Enterprise Premium CLI.
 *
 * Provides functions to:
 * - Execute API calls with retry logic.
 */

import { getAuthErrorMessage } from './auth.js'
import { TAGS, DEFAULT_CONFIG, ERROR_MESSAGES } from '../constants.js'
import { logger } from './logger.js'

/**
 * Handles API errors by logging them and throwing a formatted error.
 * @param {Error} error - The error object from the API call
 * @param {string} tag - The tag for logging
 * @param {string} operation - The operation name for logging
 * @returns {void} Nothing.
 * @throws {Error} A formatted error object
 */
export function handleApiError(error, tag, operation) {
  logger.error(`${tag} ✗ Error during ${operation}:`, error)

  if (error.response?.data) {
    logger.error(`${tag} ✗ Full error response data:`, JSON.stringify(error.response.data, null, 2))

    if (typeof error.response.data.error === 'string') {
      throw new Error(
        `API Error: ${error.response.data.error} - ${error.response.data.error_description || 'No message'}`,
      )
    } else if (error.response.data.error) {
      const { code, message, status, details } = error.response.data.error
      throw new Error(
        `API Error ${code || 'unknown'} (${status || 'unknown'}): ${message || 'No message'} - ${JSON.stringify(
          details || {},
        )}`,
      )
    } else {
      throw new Error(`API Error: ${JSON.stringify(error.response.data)}`)
    }
  }

  throw error
}

/**
 * Calls a function with retry logic for GCP API calls.
 *
 * Retries on gRPC error code 7 (PERMISSION_DENIED).
 * Catch "insufficient authentication scopes" errors and wrap them with helpful messages.
 * @param {(...args: unknown[]) => unknown} fn - The function to call
 * @param {string} description - A description of the function being called, for logging
 * @returns {Promise<unknown>} The result of the function
 * @throws {Error} If the function fails after retries or encounters a non-retriable error
 */
export async function callWithRetry(fn, description) {
  const maxRetries = DEFAULT_CONFIG.MAX_RETRIES
  const initialBackoff = DEFAULT_CONFIG.INITIAL_BACKOFF_MS
  let retries = 0

  while (true) {
    try {
      return await fn()
    } catch (error) {
      const errorMessage = error.message || ''

      if (errorMessage.toLowerCase().includes(ERROR_MESSAGES.INSUFFICIENT_SCOPES.toLowerCase())) {
        throw new Error(getAuthErrorMessage(error))
      }

      if (errorMessage.includes(ERROR_MESSAGES.QUOTA_PROJECT_NOT_SET)) {
        throw new Error(getAuthErrorMessage(error))
      }

      // Retry on PERMISSION_DENIED (gRPC code 7)
      if (error.code === 7 && retries < maxRetries) {
        retries++
        let backoff

        if (retries === 1) {
          backoff = DEFAULT_CONFIG.FIRST_RETRY_BACKOFF_MS
        } else {
          backoff = initialBackoff * Math.pow(2, retries - 2)
        }

        logger.error(
          `${TAGS.API} ⚠️ API call "${description}" failed with PERMISSION_DENIED. Retrying in ${
            backoff / 1000
          }s... (attempt ${retries}/${maxRetries})`,
        )

        await new Promise(resolve => {
          setTimeout(resolve, backoff)
        })
      } else {
        throw error
      }
    }
  }
}
