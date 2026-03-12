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
 * @fileoverview Utility for validating CEL conditions offline.
 */

import {
  UNIVERSAL_CONTENT_TYPES,
  NAVIGATION_CONTENT_TYPES,
  PASTE_CONTENT_TYPES,
  FILE_CONTENT_TYPES,
  SPECIALIZED_CONTENT_TYPES,
  CEL_FUNCTIONS,
  VALID_WEB_CATEGORIES,
  URL_RISK_LEVELS,
  CHROME_CONTEXTS,
  CHROME_ACTION_TYPES,
  URL_CATEGORY_METADATA,
} from './chrome_dlp_constants.js'

export const VALID_CEL_CONTENT_TYPES = [
  ...Object.keys(UNIVERSAL_CONTENT_TYPES),
  ...Object.keys(NAVIGATION_CONTENT_TYPES),
  ...Object.keys(PASTE_CONTENT_TYPES),
  ...Object.keys(FILE_CONTENT_TYPES),
  ...Object.keys(SPECIALIZED_CONTENT_TYPES),
]

export const VALID_CEL_METHODS = Object.keys(CEL_FUNCTIONS).map(func => {
  const match = func.match(/^([a-zA-Z0-9_]+)\(/)
  return match ? match[1] : func
})

/**
 * Basic offline CEL validator for DLP conditions.
 * @param {string} condition - The CEL condition string
 * @param {string[]} triggers - Optional list of triggers
 * @returns {{isValid: boolean, errors: string[]}} Validation result
 */
export function validateCelCondition(condition, triggers = []) {
  const errors = []

  if (!condition || condition.trim() === '') {
    return { isValid: false, errors: ['Condition cannot be empty.'] }
  }

  // Check balanced parentheses
  let openParen = 0
  for (const char of condition) {
    if (char === '(') {
      openParen++
    }
    if (char === ')') {
      openParen--
    }
    if (openParen < 0) {
      errors.push('Unbalanced parentheses: too many closing parentheses.')
      break
    }
  }
  if (openParen > 0) {
    errors.push('Unbalanced parentheses: missing closing parentheses.')
  }

  // Strip string literals to avoid false positives in regex checks
  let strippedCondition = condition
  try {
    strippedCondition = condition.replace(/("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^"\\]*)*')/g, '""')
  } catch (e) {
    // Ignore regex errors
  }

  // Check if methods are valid
  const methodRegex = /\.([a-zA-Z0-9_]+)\(/g
  let match
  while ((match = methodRegex.exec(strippedCondition)) !== null) {
    const method = match[1]
    if (!VALID_CEL_METHODS.includes(method)) {
      errors.push(
        `Invalid function/method called: '${method}'. Supported functions are: ${VALID_CEL_METHODS.join(', ')}.`,
      )
    }
  }

  // Make sure at least one valid content type is used
  const hasValidContentType = VALID_CEL_CONTENT_TYPES.some(type => {
    const regex = new RegExp(`\\b${type}\\b`)
    return regex.test(strippedCondition)
  })
  if (!hasValidContentType) {
    errors.push(
      `Condition does not appear to use a valid content type. Must use one of: ${VALID_CEL_CONTENT_TYPES.join(', ')}.`,
    )
  }

  // Validate categories inside matches_web_category
  const webCategoryRegex = /\.matches_web_category\(\s*['"]([^'"]+)['"]\s*\)/g
  let catMatch
  while ((catMatch = webCategoryRegex.exec(condition)) !== null) {
    const category = catMatch[1]
    if (!VALID_WEB_CATEGORIES.includes(category)) {
      errors.push(
        `'${category}' is not a recognized web category. Supported categories include: ${URL_CATEGORY_METADATA.commonValuesDescription}, etc.`,
      )
    }
  }

  // Validate other enum-like values (source_chrome_context, etc.)
  const enumValidationMap = {
    source_chrome_context: CHROME_CONTEXTS,
  }

  for (const [field, enumObj] of Object.entries(enumValidationMap)) {
    const regex = new RegExp(`\\b${field}\\b\\s*(?:==|\\.matches_enum\\()\\s*['"]([^'"]+)['"]`, 'g')
    let match
    while ((match = regex.exec(condition)) !== null) {
      const value = match[1]
      const validValues = Object.values(enumObj).map(v => v.value)
      if (!validValues.includes(value)) {
        errors.push(`'${value}' is not a valid value for '${field}'. Valid values are: ${validValues.join(', ')}.`)
      }
    }
  }

  // Specialized risk level validation (url.matches_enum or url_category.matches_enum)
  const riskLevelRegex = /(?:url|url_category)\.matches_enum\(\s*['"]([^'"]+)['"]\s*\)/g
  let rlMatch
  while ((rlMatch = riskLevelRegex.exec(condition)) !== null) {
    const value = rlMatch[1]
    const validValues = Object.values(URL_RISK_LEVELS).map(v => v.value)
    if (!validValues.includes(value)) {
      errors.push(`'${value}' is not a valid risk level. Valid levels are: ${validValues.join(', ')}.`)
    }
  }

  // Validate matches_mime_types (requires a list, even for single value)
  const mimeTypeRegex = /\.matches_mime_types\(\s*['"]([^'"]+)['"]\s*\)/g
  if (mimeTypeRegex.test(condition)) {
    errors.push(
      "The 'matches_mime_types' function requires a list of strings (e.g. .matches_mime_types(['application/pdf'])), even for a single value.",
    )
  }

  // Hard fail if url.matches_web_category is used instead of url_category
  if (condition.includes('url.matches_web_category')) {
    errors.push(
      "The 'matches_web_category' function must be called on 'url_category', not 'url' (i.e. 'url_category.matches_web_category(...)').",
    )
  }

  // Exhaustive Trigger Compatibility Checks
  // A rule is valid if AT LEAST ONE trigger supports the attribute/function used.
  if (triggers.length > 0) {
    // 1. URL category matching
    const hasCategoryMethod =
      condition.includes('.matches_web_category') ||
      (condition.includes('_category') && condition.includes('.matches_enum'))

    if (hasCategoryMethod) {
      const allowedTriggers = ['URL_NAVIGATION', 'FILE_DOWNLOAD', 'WEB_CONTENT_UPLOAD']
      const isSupported = triggers.some(t => allowedTriggers.includes(t))
      if (!isSupported) {
        errors.push(
          `URL category matching is only supported with URL_NAVIGATION, FILE_DOWNLOAD, or WEB_CONTENT_UPLOAD triggers.`,
        )
      }
    }

    // 2. Risk level compatibility
    if (/\burl\.matches_enum\b/.test(condition)) {
      const isSupported = triggers.some(t => t === 'URL_NAVIGATION')
      if (!isSupported) {
        errors.push(`Risk level filtering via 'url.matches_enum' is only supported with the 'URL_NAVIGATION' trigger.`)
      }
    }
    if (/\burl_category\.matches_enum\b/.test(condition)) {
      const isSupported = triggers.some(t => t === 'FILE_DOWNLOAD')
      if (!isSupported) {
        errors.push(
          `Risk level filtering via 'url_category.matches_enum' is only supported with the 'FILE_DOWNLOAD' trigger.`,
        )
      }
    }

    // 3. source_ fields compatibility (mostly paste origin)
    const sourceFields = [
      'source_url',
      'source_url_category',
      'source_chrome_context',
      'source_web_app_signed_in_account',
    ]
    const hasSourceField = sourceFields.some(field => new RegExp(`\\b${field}\\b`).test(condition))
    if (hasSourceField) {
      const isSupported = triggers.some(t => t === 'WEB_CONTENT_UPLOAD')
      if (!isSupported) {
        errors.push(
          `Attributes referring to the source/origin (e.g., 'source_url', 'source_chrome_context') are only supported with the 'WEB_CONTENT_UPLOAD' (paste) trigger.`,
        )
      }
    }

    // 4. destination_url compatibility (Not supported for Chrome)
    if (/\bdestination_url\b/.test(condition)) {
      errors.push(
        "The 'destination_url' attribute is not supported for Chrome DLP rules. Use 'url' to refer to the target of the action.",
      )
    }

    // 5. Navigation restrictions (no all_content, body, title for URL_NAVIGATION)
    const contentFields = ['all_content', 'body', 'title']
    contentFields.forEach(field => {
      if (new RegExp(`\\b${field}\\b`).test(condition)) {
        // Supported by everything EXCEPT URL_NAVIGATION
        const allowedTriggers = ['FILE_UPLOAD', 'FILE_DOWNLOAD', 'WEB_CONTENT_UPLOAD', 'PRINT']
        const isSupported = triggers.some(t => allowedTriggers.includes(t))
        if (!isSupported && triggers.includes('URL_NAVIGATION')) {
          errors.push(`The '${field}' attribute is not supported with the 'URL_NAVIGATION' trigger.`)
        }
      }
    })

    // 6. file_ attributes compatibility
    if (new RegExp(`\\bfile_size_in_bytes\\b`).test(condition)) {
      const allowedTriggers = ['FILE_UPLOAD', 'FILE_DOWNLOAD']
      const isSupported = triggers.some(t => allowedTriggers.includes(t))
      if (!isSupported) {
        errors.push(`The 'file_size_in_bytes' attribute is only supported with FILE_UPLOAD or FILE_DOWNLOAD triggers.`)
      }
    }
    if (new RegExp(`\\bfile_type\\b`).test(condition)) {
      const allowedTriggers = ['FILE_UPLOAD', 'FILE_DOWNLOAD', 'PRINT']
      const isSupported = triggers.some(t => allowedTriggers.includes(t))
      if (!isSupported) {
        errors.push(`The 'file_type' attribute is only supported with FILE_UPLOAD, FILE_DOWNLOAD, or PRINT triggers.`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validates action parameter compatibility.
 * @param {string} action - The action type (BLOCK, WARN, AUDIT)
 * @param {object} params - The action parameters
 * @returns {{isValid: boolean, errors: string[]}} Validation result
 */
export function validateActionParameters(action, params = {}) {
  const errors = []
  const { customMessage, watermarkMessage, blockScreenshot } = params

  if (action === CHROME_ACTION_TYPES.AUDIT && customMessage) {
    errors.push(`The 'customMessage' parameter is not supported with the 'AUDIT' action type.`)
  }
  if (action === CHROME_ACTION_TYPES.BLOCK) {
    if (watermarkMessage) {
      errors.push(`The 'watermarkMessage' parameter is not supported with the 'BLOCK' action type.`)
    }
    if (blockScreenshot) {
      errors.push(`The 'blockScreenshot' parameter is not supported with the 'BLOCK' action type.`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
