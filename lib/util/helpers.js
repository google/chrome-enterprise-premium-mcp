/**
 * @fileoverview Helper functions for the Chrome Enterprise Premium CLI.
 *
 * Provides functions to:
 * - Execute API calls with retry logic.
 */

import { getAuthErrorMessage } from './auth.js'
import { TAGS, DEFAULT_CONFIG, ERROR_MESSAGES } from '../constants.js'

/**
 * Calls a function with retry logic for GCP API calls.
 *
 * Retries on gRPC error code 7 (PERMISSION_DENIED).
 * Catch "insufficient authentication scopes" errors and wrap them with helpful messages.
 *
 * @param {Function} fn - The function to call
 * @param {string} description - A description of the function being called, for logging
 * @returns {Promise<any>} The result of the function
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

                console.error(
                    `${TAGS.API} ⚠️ API call "${description}" failed with PERMISSION_DENIED. Retrying in ${
                        backoff / 1000
                    }s... (attempt ${retries}/${maxRetries})`,
                )

                await new Promise(resolve => setTimeout(resolve, backoff))
            } else {
                throw error
            }
        }
    }
}
