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
 * @file Human-readable error messages for Google API auth failures.
 *
 * Detects insufficient-scope, missing-credential, and missing-quota-project
 * errors and returns OAuth-flow remediation pointing at `mcp auth login`.
 */

import { ERROR_MESSAGES } from '../constants.js'

/**
 * Generates a descriptive error message for authentication failures.
 * @param {Error} error - The original error thrown during an auth-related call.
 * @returns {Promise<string>} A formatted error message with OAuth-flow remediation.
 */
export async function getAuthErrorMessage(error) {
  const errorMessage = error.message || ''
  const lower = errorMessage.toLowerCase()
  const isInsufficientScopes = lower.includes(ERROR_MESSAGES.INSUFFICIENT_SCOPES.toLowerCase())
  const isNoCredentials = lower.includes(ERROR_MESSAGES.NO_CREDENTIALS.toLowerCase())
  const isQuotaProjectNotSet = errorMessage.includes(ERROR_MESSAGES.QUOTA_PROJECT_NOT_SET)

  let instruction = ''
  if (isInsufficientScopes) {
    instruction =
      'The cached OAuth token is missing one or more required scopes. Re-run `mcp auth login` to re-consent with the updated scope set.'
  } else if (isNoCredentials) {
    instruction = 'No OAuth tokens cached. Run `mcp auth login` to authenticate.'
  } else if (isQuotaProjectNotSet) {
    instruction =
      'Google could not attribute the request to a billing project. For BYO OAuth clients, enable the required APIs (admin.googleapis.com, chromemanagement.googleapis.com, chromepolicy.googleapis.com, cloudidentity.googleapis.com) in the Google Cloud project that owns your OAuth client.'
  }

  if (instruction) {
    return `${instruction}\n\nOriginal error message from Google Auth Library: ${errorMessage}`
  }
  return `ERROR: Authentication failed.\nOriginal error message: ${errorMessage}`
}
