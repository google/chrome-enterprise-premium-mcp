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
 * @file Human-readable error messages and remediation for Google API auth failures.
 *
 * Detects insufficient-scopes and SERVICE_DISABLED errors, and returns
 * targeted remediation instructions depending on whether the active session
 * used a Bearer token (Gemini CLI), Service Account ADC (Production), or the
 * local OAuth cache (CLI login).
 */

import { ERROR_MESSAGES, SERVICE_NAMES, MANAGED_OAUTH_CLIENT_ID } from '../constants.js'
import { cliInvocation } from './cli_invocation.js'

/**
 * Resolves the active credential source based on environment and headers.
 * @param {string|null} authToken - Inbound bearer token if present.
 * @returns {'bearer'|'cache'} The resolved credential source.
 */
export function resolveCredentialsSource(authToken) {
  if (authToken) {
    return 'bearer'
  }
  return 'cache'
}

/**
 * Generates targeted, human-readable remediation instructions for auth failures.
 * @param {Error} error - The original error thrown during an auth-related call.
 * @param {'bearer'|'adc'|'cache'|'provided'} [source] - The active credential source.
 * @returns {string} A formatted error message with targeted remediation.
 */
export function getAuthErrorMessage(error, source = 'cache') {
  const errorMessage = error.message || ''
  const lower = errorMessage.toLowerCase()
  const isInsufficientScopes = lower.includes(ERROR_MESSAGES.INSUFFICIENT_SCOPES.toLowerCase())
  const isApiNotEnabled = errorMessage.includes(ERROR_MESSAGES.API_NOT_USED_IN_PROJECT)

  const authProjectNumber = MANAGED_OAUTH_CLIENT_ID.split('-')[0]
  const mentionsDefaultAuthProject = errorMessage.includes(authProjectNumber)

  const status = error.status || error.code || error.response?.status
  const is401 =
    status === 401 || lower.includes('401') || lower.includes('unauthenticated') || lower.includes('invalid_grant')
  const resolvedStatus = is401 ? 401 : 403

  let instruction = ''

  if (source === 'bearer') {
    if (resolvedStatus === 401) {
      instruction =
        'Authentication required. The inbound Bearer token has expired or is invalid. ' +
        'Please re-authenticate or refresh the connection in your client application. ' +
        "If you are using the Gemini CLI, you can run '/mcp reauth'."
    } else if (isApiNotEnabled) {
      if (mentionsDefaultAuthProject) {
        instruction =
          `A required API is disabled for the default Google-managed 1P OAuth project (${authProjectNumber}).\n\n` +
          'For first-party (1P) authentication, APIs must be enabled on the default project rather than your own project. ' +
          'Because you do not have permissions to modify the default 1P project, please reach out to a Chrome Enterprise Premium team member ' +
          `to enable the missing API on project ${authProjectNumber}.`
      } else {
        instruction =
          'A required API is not enabled in the Google Cloud project that owns your OAuth client.\n\n' +
          'Please ask your Google Cloud administrator to enable the required APIs listed in lib/constants.js#SERVICE_NAMES.'
      }
    } else {
      instruction = `Permission denied. The authenticated principal lacks the required permissions, or the necessary Google Cloud APIs are not enabled.

1. **Re-authenticate:** Refresh the inbound Bearer token through your client application (for example, by running '/mcp reauth' in Gemini CLI or restarting the session) to ensure it is fresh.
2. **Verify Workspace Roles:** Ensure the Google account you signed in with has the necessary Chrome Enterprise or Workspace delegated administrator roles.
3. **Verify APIs are enabled:** Ask your Google Cloud administrator to enable the required APIs listed in lib/constants.js#SERVICE_NAMES.`
    }
  } else if (source === 'provided') {
    if (resolvedStatus === 401) {
      instruction = 'Authentication required. The caller-provided custom AuthClient has invalid or expired credentials.'
    } else {
      instruction =
        'Permission denied. The caller-provided custom AuthClient lacks necessary permissions or required GCP APIs are disabled.'
    }
  } else {
    // Fallback/Default to 'cache' (local OAuth flow)
    const manualLogin = cliInvocation('auth login')
    if (resolvedStatus === 401) {
      instruction = `Authentication required. Run the \`cep_auth\` tool to sign in, or run \`${manualLogin}\` at the shell to authorize the server (it caches the access token at ~/.config/cep-mcp/tokens.json).`
    } else if (isInsufficientScopes) {
      instruction = `The cached OAuth token is missing one or more required scopes. Run the \`cep_auth\` tool, or re-run \`${manualLogin}\` at the shell, to re-consent with the updated scope set.`
    } else if (isApiNotEnabled) {
      if (mentionsDefaultAuthProject) {
        instruction =
          `A required API is disabled for the default Google-managed 1P OAuth project (${authProjectNumber}).\n\n` +
          'For first-party (1P) authentication, APIs must be enabled on the default project rather than your own project. ' +
          'Because you do not have permissions to modify the default 1P project, please reach out to a Chrome Enterprise Premium team member ' +
          `to enable the missing API on project ${authProjectNumber}.\n\n` +
          'Alternatively, if you are using a custom OAuth client (BYO), ensure that you have enabled ' +
          'the required Workspace APIs in your own Google Cloud project (e.g., via the check_and_enable_cep_api tool).'
      } else {
        instruction =
          'A required API is not enabled in the Google Cloud project that owns your OAuth client.\n\n' +
          'Enable the required APIs in that project:\n' +
          `  gcloud services enable ${Object.values(SERVICE_NAMES).join(' ')} --project=YOUR_PROJECT_ID\n\n` +
          'Or call the check_and_enable_cep_api tool against your project. ' +
          'For the full BYO OAuth-client walkthrough, see:\n' +
          '  https://github.com/google/chrome-enterprise-premium-mcp/blob/main/docs/auth-bring-your-own-oauth-client.md'
      }
    } else {
      instruction = `Permission denied. Your account lacks the required permissions, or the necessary Google Cloud APIs are not enabled.

1. **Re-authenticate with all required scopes:** Run the \`cep_auth\` tool, or run \`${manualLogin}\` at the shell to re-consent. The required scope set is defined in lib/constants.js#SCOPES.
2. **Verify APIs are enabled:** Run the \`check_and_enable_cep_api\` tool against your project, or enable the API set listed in lib/constants.js#SERVICE_NAMES.`
    }
  }

  if (instruction) {
    return `${instruction}\n\nOriginal error message from Google APIs: ${errorMessage}`
  }
  return `ERROR: Authentication failed.\nOriginal error message: ${errorMessage}`
}
