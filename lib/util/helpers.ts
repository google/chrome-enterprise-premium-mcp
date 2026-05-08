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
import { cloudidentity_v1 } from 'googleapis'

interface ApiErrorData {
  error?:
    | string
    | {
        code?: number | string
        message?: string
        status?: string
        details?: Record<string, unknown>
      }
  error_description?: string
}

export interface ApiError {
  message?: string
  response?: {
    data?: ApiErrorData
    status?: number
  }
}

/**
 * Type guard to check if an error is a Google API / Gaxios error.
 * @param err The error to check.
 * @returns True if the error structurally matches ApiError.
 */
export function isApiError(err: unknown): err is ApiError {
  if (typeof err !== 'object' || err === null) {
    return false
  }
  if ('response' in err && err.response !== undefined) {
    const response = err.response
    if (typeof response !== 'object' || response === null) {
      return false
    }
    if ('data' in response && response.data !== undefined) {
      const data = response.data
      if (typeof data !== 'object' || data === null) {
        return false
      }
    }
  }
  return true
}

/**
 * Handles API errors by logging them and throwing a formatted error.
 */
export function handleApiError(error: unknown, tag: string, operation: string): never {
  logger.error(`${tag} Error during ${operation}:`, error)

  if (isApiError(error)) {
    const data = error.response?.data
    if (data) {
      logger.error(`${tag} Full error response data:`, JSON.stringify(data, null, 2))

      const errObj = data.error
      if (typeof errObj === 'string') {
        throw new Error(`API Error: ${errObj} - ${data.error_description || 'No message'}`)
      } else if (errObj) {
        const { code, message, status, details } = errObj
        throw new Error(
          `API Error ${code || 'unknown'} (${status || 'unknown'}): ${message || 'No message'} - ${JSON.stringify(
            details || {},
          )}`,
        )
      } else {
        throw new Error(`API Error: ${JSON.stringify(data)}`)
      }
    }
  }

  if (error instanceof Error) {
    throw error
  }
  throw new Error(String(error))
}

/**
 * Calls a function with retry logic for GCP API calls.
 */
export async function callWithRetry<T>(fn: () => Promise<T> | T, _description: string): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message || ''

      if (errorMessage.toLowerCase().includes(ERROR_MESSAGES.INSUFFICIENT_SCOPES.toLowerCase())) {
        throw new Error(await getAuthErrorMessage(error))
      }

      if (errorMessage.includes(ERROR_MESSAGES.QUOTA_PROJECT_NOT_SET)) {
        throw new Error(await getAuthErrorMessage(error))
      }
    }

    throw error
  }
}

/**
 * Formats a raw string (e.g., SNAKE_CASE status) to Title Case with spaces.
 */
export function formatStatus(s: string | null | undefined): string {
  if (!s) {
    return 'Unknown'
  }
  return String(s)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase())
}

export interface ParsedDlpRule {
  name: string
  status: string
  action: string
  triggers: string
  condition: string
  resourceName: string
}

/**
 * Parses a raw Cloud Identity policy representing a Chrome DLP rule into a structured format.
 */
export function parseDlpRule(policy: cloudidentity_v1.Schema$Policy): ParsedDlpRule {
  const setting = policy.setting
  const value = setting && isObject(setting.value) ? setting.value : null

  // Extract display name with fallbacks
  let name = 'Unnamed Rule'
  if (value) {
    name = getString(value, 'displayName') || name
  }
  if (name === 'Unnamed Rule' && setting && isObject(setting)) {
    name = getString(setting, 'displayName') || name
  }
  if (name === 'Unnamed Rule' && isObject(policy)) {
    name = getString(policy, 'displayName') || name
  }

  // Extract status
  let rawState: string | undefined
  if (value) {
    rawState = getString(value, 'state')
  }
  if (!rawState && setting && isObject(setting)) {
    rawState = getString(setting, 'state')
  }
  const status = formatStatus(rawState)

  // Extract action
  let action = 'Unknown'
  if (value) {
    const actionObj = getObject(value, 'action')
    if (actionObj) {
      const chromeAction = getObject(actionObj, 'chromeAction')
      if (chromeAction) {
        const foundAction = Object.values(CHROME_ACTION_TYPES).find(a => chromeAction[a.apiKey] !== undefined)
        if (foundAction) {
          action = foundAction.value.charAt(0).toUpperCase() + foundAction.value.slice(1).toLowerCase()
        }
      }
    }
  }

  // Extract triggers
  let triggerList: string[] = []
  if (value) {
    triggerList = getStringArray(value, 'triggers') || []
  }
  const triggers = triggerList
    .map(t =>
      t
        .replace(/^(?:google\.workspace\.)?chrome\./, '')
        .split('.')
        .filter(part => !/^v\d+$/.test(part))
        .join('.'),
    )
    .join(', ')

  // Extract condition
  let condition = 'None'
  if (value) {
    const condObj = getObject(value, 'condition')
    if (condObj) {
      condition = getString(condObj, 'contentCondition') || condition
    }
  }

  return {
    name,
    status,
    action,
    triggers,
    condition,
    resourceName: policy.name || '',
  }
}

// --- Type Guards and Safe Extracts ---

/**
 * Type guard to check if a value is a plain object.
 * @param val The value to check.
 * @returns True if the value is an object and not null.
 */
export function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null
}

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every(item => typeof item === 'string')
}

/**
 * Safely extracts a nested object property.
 * @param obj The source object.
 * @param key The property key.
 * @returns The nested object, or undefined if not an object or missing.
 */
export function getObject(obj: unknown, key: string): Record<string, unknown> | undefined {
  if (isObject(obj)) {
    const val = obj[key]
    if (isObject(val)) {
      return val
    }
  }
  return undefined
}

/**
 * Safely extracts a string property from an object.
 * @param obj The source object.
 * @param key The property key.
 * @returns The string value, or undefined if not a string or missing.
 */
export function getString(obj: unknown, key: string): string | undefined {
  if (isObject(obj)) {
    const val = obj[key]
    if (typeof val === 'string') {
      return val
    }
  }
  return undefined
}

/**
 * Safely extracts a number property from an object.
 * @param obj The source object.
 * @param key The property key.
 * @returns The number value, or undefined if not a number or missing.
 */
export function getNumber(obj: unknown, key: string): number | undefined {
  if (isObject(obj)) {
    const val = obj[key]
    if (typeof val === 'number') {
      return val
    }
  }
  return undefined
}

/**
 * Safely extracts a string array property from an object.
 * @param obj The source object.
 * @param key The property key.
 * @returns The array of strings, or undefined if not an array of strings or missing.
 */
export function getStringArray(obj: Record<string, unknown>, key: string): string[] | undefined {
  const val = obj[key]
  if (isStringArray(val)) {
    return val
  }
  return undefined
}
