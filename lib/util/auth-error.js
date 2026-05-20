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
 * Detects insufficient-scope errors and the SERVICE_DISABLED 403 ("API has
 * not been used in project ...") that fires when an OAuth client owns a
 * Google Cloud project that has not enabled the Workspace APIs this server
 * uses. Returns OAuth-flow-flavored remediation.
 */

import { ERROR_MESSAGES, SERVICE_NAMES, MANAGED_OAUTH_CLIENT_ID } from '../constants.js'
import { cliInvocation } from './cli_invocation.js'

/**
 * Generates a descriptive error message for authentication failures.
 * @param {Error} error - The original error thrown during an auth-related call.
 * @returns {string} A formatted error message with OAuth-flow remediation.
 */
export function getAuthErrorMessage(error) {
  const errorMessage = error.message || ''
  const lower = errorMessage.toLowerCase()
  const isInsufficientScopes = lower.includes(ERROR_MESSAGES.INSUFFICIENT_SCOPES.toLowerCase())
  const isApiNotEnabled = errorMessage.includes(ERROR_MESSAGES.API_NOT_USED_IN_PROJECT)

  let instruction = ''
  if (isInsufficientScopes) {
    instruction = `The cached OAuth token is missing one or more required scopes. Run the \`cep_auth\` tool, or re-run \`${cliInvocation('auth login')}\` at the shell, to re-consent with the updated scope set.`
  } else if (isApiNotEnabled) {
    const apiList = Object.values(SERVICE_NAMES).join(' ')
    const authProjectNumber = MANAGED_OAUTH_CLIENT_ID.split('-')[0]
    const mentionsDefaultAuthProject = errorMessage.includes(authProjectNumber)

    if (mentionsDefaultAuthProject) {
      instruction =
        `A required API is disabled for the default Google-managed 1P OAuth project (${authProjectNumber}).\n\n` +
        'For first-party (1P) authentication, APIs must be enabled on the default project rather than your own project. ' +
        'Because you do not have permissions to modify the default 1P project, please reach out to a Chrome Enterprise Premium team member ' +
        `to enable the missing API on project ${authProjectNumber}.\n\n` +
        'Alternatively, if you are using a custom OAuth client (BYO) or a service account, ensure that you have enabled ' +
        'the required Workspace APIs in your own Google Cloud project (e.g., via the check_and_enable_cep_api tool).'
    } else {
      instruction =
        'A required API is not enabled in the Google Cloud project that owns your OAuth client.\n\n' +
        'Enable the required APIs in that project:\n' +
        `  gcloud services enable ${apiList} --project=YOUR_PROJECT_ID\n\n` +
        'Or call the check_and_enable_cep_api tool against your project. ' +
        'For the full BYO OAuth-client walkthrough, see:\n' +
        '  https://github.com/google/chrome-enterprise-premium-mcp/blob/main/docs/auth-bring-your-own-oauth-client.md'
    }
  }

  if (instruction) {
    return `${instruction}\n\nOriginal error message from Google Auth Library: ${errorMessage}`
  }
  return `ERROR: Authentication failed.\nOriginal error message: ${errorMessage}`
}
