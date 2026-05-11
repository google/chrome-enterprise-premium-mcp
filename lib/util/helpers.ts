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
import { ERROR_MESSAGES } from '../constants.js'
import { logger } from './logger.js'
import { CHROME_ACTION_TYPES } from './chrome_dlp_constants.js'

/**
 * Handles API errors by logging them and throwing a formatted error.
 * @param {Error} error - The error object from the API call
 * @param {string} tag - The tag for logging
 * @param {string} operation - The operation name for logging
 * @throws {Error} A formatted error object
 */
export function handleApiError(error, tag, operation) {
  logger.error(`${tag} Error during ${operation}:`, error)

  if (error.response?.data) {
    logger.error(`${tag} Full error response data:`, JSON.stringify(error.response.data, null, 2))

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
 * Wraps GCP API calls. Currently throws immediately for any error after detecting
 * INSUFFICIENT_SCOPES and QUOTA_PROJECT_NOT_SET hints. The retry scaffolding is
 * preserved for future transient-error handling.
 * @param {(...args: unknown[]) => unknown} fn - The function to call
 * @param {string} _description - A description of the function being called, for logging
 * @returns {Promise<unknown>} The result of the function
 * @throws {Error} If the function fails or encounters an auth-related error
 */
export async function callWithRetry(fn, _description) {
  try {
    return await fn()
  } catch (error) {
    const errorMessage = error.message || ''

    if (errorMessage.toLowerCase().includes(ERROR_MESSAGES.INSUFFICIENT_SCOPES.toLowerCase())) {
      throw new Error(await getAuthErrorMessage(error))
    }

    if (errorMessage.includes(ERROR_MESSAGES.QUOTA_PROJECT_NOT_SET)) {
      throw new Error(await getAuthErrorMessage(error))
    }

    throw error
  }
}

/**
 * Formats a raw string (e.g., SNAKE_CASE status) to Title Case with spaces.
 * @param {string} s - The raw string
 * @returns {string} The formatted string
 */
export function formatStatus(s) {
  if (!s) {
    return 'Unknown'
  }
  return String(s)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Parses a raw Cloud Identity policy representing a Chrome DLP rule into a structured format.
 * @param {object} policy - The raw policy object from the API.
 * @returns {object} The parsed rule metadata.
 */
export function parseDlpRule(policy) {
  const setting = policy.setting || {}
  const value = setting.value || {}

  const name = value.displayName || setting.displayName || policy.displayName || 'Unnamed Rule'
  const status = formatStatus(value.state || setting.state)

  let action = 'Unknown'
  const chromeAction = value.action?.chromeAction || {}
  const foundAction = Object.values(CHROME_ACTION_TYPES).find(a => chromeAction[a.apiKey])
  if (foundAction) {
    action = foundAction.value.charAt(0).toUpperCase() + foundAction.value.slice(1).toLowerCase()
  }

  const triggers = (value.triggers || [])
    .map(t =>
      t
        .replace(/^(?:google\.workspace\.)?chrome\./, '')
        .split('.')
        .filter(part => !/^v\d+$/.test(part))
        .join('.'),
    )
    .join(', ')

  const condition = value.condition?.contentCondition || 'None'

  return {
    name,
    status,
    action,
    triggers,
    condition,
    resourceName: policy.name,
  }
}
