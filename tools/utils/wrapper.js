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
 * @file Wrapper utilities to guard and transform MCP tool calls.
 */

import { TAGS } from '../../lib/constants.js'
import { getActiveScopes } from '../../lib/util/feature_flags.js'
import { logger } from '../../lib/util/logger.js'
import { validateAndGetOrgUnitId } from './org-unit.js'
import { isTokenLocallyValid } from '../../lib/util/credential/auth_login.js'
import { cliInvocation } from '../../lib/util/cli_invocation.js'
import { isBearerMode, isServiceAccountMode, isDynamicMode } from '../../lib/util/auth_mode.js'
import { getAuthErrorMessage } from '../../lib/util/auth-error.js'

/**
 * Builds an MCP tool response signalling that sign-in is needed before any tool can run.
 * @param {{reason: 'missing'|'expired'|'malformed', expiresAt?: Date|null}} validity The reason the pre-flight failed.
 * @returns {object} MCP tool response with isError: true.
 */
function buildAuthRequiredResponse({ reason, expiresAt }) {
  const reasonLabel =
    {
      expired: 'expired',
      malformed: 'unreadable',
      insufficient: 'insufficient',
    }[reason] || 'missing'
  const expiredAtNote = reason === 'expired' && expiresAt ? ` (expired at ${expiresAt.toISOString()})` : ''
  const text =
    `Sign-in is needed before this tool can run. The cached OAuth token is ${reasonLabel}${expiredAtNote}. ` +
    'I can run the `cep_auth` tool to sign you in, or you can run ' +
    `\`${cliInvocation('auth login')}\` yourself.`

  return {
    content: [{ type: 'text', text }],
    // We return this as a standard unstructured error to bypass the following SDK bugs:
    // 1. MCP Server SDK Crash: serialization fails for z.union() or non-object outputSchema
    //    (TypeError: Cannot read properties of undefined reading '_zod') during init.
    // 2. MCP Client (Gemini CLI) Rigid Validation: structuredContent is validated against
    //    the success schema even when isError: true is set, causing client-side crashes.
    // By using unstructured text, we keep data schemas strict while maintaining agent utility.
    isError: true,
  }
}

const TOOL_PRIVILEGES_MAP = {
  list_org_units: {
    privilege: 'Services > Google Workspace > Directory > Read organizational units',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  security_insights: {
    privilege: 'Services > Chrome Enterprise Security Insights (or Chrome Management)',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  count_browser_versions: {
    privilege: 'Services > Chrome Management > Manage ChromeOS Devices (Read-only)',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  list_customer_profiles: {
    privilege: 'Services > Chrome Management > Settings > Managed Browsers',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  get_chrome_activity_log: {
    privilege: 'Services > Chrome Management > Manage ChromeOS Devices (and Reports > Audit Reports)',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  check_cep_subscription: {
    privilege: 'Services > License Management > License Read',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  check_user_cep_license: {
    privilege: 'Services > License Management > License Read',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  list_dlp_rules: {
    privilege: 'Services > Cloud Identity > Security > View / Manage Data Loss Prevention (DLP) rules and detectors',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  get_dlp_rule: {
    privilege: 'Services > Cloud Identity > Security > View / Manage Data Loss Prevention (DLP) rules and detectors',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  list_detectors: {
    privilege: 'Services > Cloud Identity > Security > View / Manage Data Loss Prevention (DLP) rules and detectors',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  create_chrome_dlp_rule: {
    privilege: 'Services > Cloud Identity > Security > View / Manage Data Loss Prevention (DLP) rules and detectors',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
  create_regex_detector: {
    privilege: 'Services > Cloud Identity > Security > View / Manage Data Loss Prevention (DLP) rules and detectors',
    roleUrl: 'https://admin.google.com/ac/roles',
  },
}

/**
 * Helper to dynamically retrieve all tools requiring delegation.
 * @param {object} server - The McpServer instance.
 * @returns {string[]} List of tool names requiring DWD.
 */
function getDwdTools(server) {
  const dwdTools = []
  if (server && server._registeredTools) {
    for (const [name, tool] of Object.entries(server._registeredTools)) {
      if (tool.handler && tool.handler.requiresDelegation) {
        dwdTools.push(name)
      }
    }
  }
  return dwdTools
}

/**
 * Generates a proactive remediation message for authentication errors.
 * @param {number} status - HTTP status code (401 or 403) or resolved equivalent.
 * @param {Error|null} error - The original error thrown.
 * @param {boolean} bearerInbound - True if request used inbound Bearer auth
 * @param {string} [toolName] - Name of the tool being executed
 * @param {object} [server] - The McpServer instance.
 * @returns {string} Human-readable remediation instructions
 */
function getAuthRemediationMessage(status, error, bearerInbound = false, toolName = '', server = null) {
  if (status === 403 && toolName && TOOL_PRIVILEGES_MAP[toolName]) {
    const info = TOOL_PRIVILEGES_MAP[toolName]
    return `Permission denied (403 Forbidden) while calling \`${toolName}\`. Your account lacks the required Google Workspace Admin Console privilege:\n• **${info.privilege}**\n\n**To fix:** Open [Workspace Admin Roles](${info.roleUrl}) and assign any role (or custom role) granting this privilege to your account (e.g., *Delegated Admin* or *Super Admin*).`
  }

  if (bearerInbound) {
    if (status === 401) {
      let dwdToolsList = ''
      if (server) {
        const dwdTools = getDwdTools(server)
        if (dwdTools.length > 0) {
          dwdToolsList =
            '\n\nNote: The following tools require Domain-Wide Delegation (impersonation) and might also fail in this mode:\n' +
            dwdTools.map(t => `- ${t}`).join('\n')
        }
      }
      return `Authentication required. The inbound Bearer token has expired, is invalid, or lacks Domain-Wide Delegation (impersonation) required for Workspace APIs. Re-authenticate through your MCP client to refresh the token, or configure Domain-Wide Delegation (impersonation) in your Service Account setup.${dwdToolsList}`
    }
    return `Permission denied. The authenticated principal lacks the required permissions, or the necessary Google Cloud APIs are not enabled.

1. **Re-authenticate:** Refresh the inbound Bearer token through your MCP client.
2. **Verify APIs are enabled:** Run the \`check_and_enable_cep_api\` tool against your project, or enable the API set listed in \`lib/constants.js#SERVICE_NAMES\`.`
  }

  const isSaMode = !!process.env.GOOGLE_APPLICATION_CREDENTIALS
  const errorMessage = error?.message || ''
  const isCredentialFailure =
    status === 401 ||
    errorMessage.includes('invalid_grant') ||
    errorMessage.includes('unauthorized_client') ||
    errorMessage.includes('UNAUTHENTICATED')

  if (isSaMode) {
    if (isCredentialFailure) {
      const detailedMessage = getAuthErrorMessage(error)
      if (detailedMessage.startsWith('ERROR: Authentication failed')) {
        return `Authentication required. The Service Account credentials configured in GOOGLE_APPLICATION_CREDENTIALS are invalid or domain-wide delegation failed. Ensure the Service Account JSON key is valid and domain-wide delegation (CEP_IMPERSONATE_SUBJECT) is configured in Google Workspace Admin Console.\n\nOriginal error: ${errorMessage}`
      }
      return detailedMessage
    }
    return `Permission denied. The Service Account lacks required Google Workspace / Chrome Enterprise permissions or domain-wide delegation OAuth scopes. Verify that the Service Account has required IAM roles and that Domain-Wide Delegation in Google Workspace Admin Console includes the necessary scopes.`
  }

  const manualLogin = cliInvocation('auth login')
  if (isCredentialFailure) {
    return `Authentication required. Run the \`cep_auth\` tool to sign in, or run \`${manualLogin}\` at the shell to authorize the server (it caches the access token at ~/.config/cep-mcp/tokens.json). To use a service account, set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file.`
  }

  return `Permission denied. Your account lacks the required permissions or the necessary Google Cloud APIs are not enabled.

1. **Re-authenticate with all required scopes:** Run the \`cep_auth\` tool, or run \`${manualLogin}\` at the shell, to re-consent. The required scope set is defined in lib/constants.js#SCOPES.
2. **Verify APIs are enabled:** Run the \`check_and_enable_cep_api\` tool against your project, or enable the API set listed in lib/constants.js#SERVICE_NAMES.
`
}

/**
 * Extracts bearer token from request info if present
 * @param {object} [requestInfo] - Inbound MCP request metadata
 * @returns {string|null} Bearer token string or null
 */
function getAuthToken(requestInfo) {
  return requestInfo?.headers?.authorization ? requestInfo.headers.authorization.split(' ')[1] : null
}

/**
 * Performs common transformations on tool parameters.
 * @param {object} params - The tool parameters to transform
 * @returns {object} The transformed parameters
 */
export function commonTransform(params) {
  const newParams = { ...params }
  if (newParams.orgUnitId) {
    newParams.orgUnitId = validateAndGetOrgUnitId(newParams.orgUnitId)
  }
  return newParams
}

/**
 * Formats a tool response with a summary and a fenced JSON block.
 * @param {object} params - The response parameters
 * @param {string} params.summary - Human-readable summary (markdown)
 * @param {object} [params.data] - Data to be serialized in the JSON block
 * @param {object} [params.structuredContent] - Machine-readable content for SDK
 * @returns {object} MCP-compatible tool response
 */
export function formatToolResponse({ summary, data, structuredContent }) {
  return {
    content: [
      { type: 'text', text: summary },
      { type: 'text', text: '```json\n' + JSON.stringify(data, null, 2) + '\n```' },
    ],
    structuredContent,
  }
}

/**
 * Wraps a formatting function with graceful degradation if it fails.
 * @param {object} params - The formatting parameters
 * @param {unknown} params.rawData - The raw data to format
 * @param {(...args: unknown[]) => unknown} params.formatFn - Function that returns a formatToolResponse-compatible object
 * @param {string} params.toolName - Name of the tool for logging
 * @returns {object} Formatted tool response
 */
export function safeFormatResponse({ rawData, formatFn, toolName }) {
  try {
    return formatFn(rawData)
  } catch (e) {
    logger.warn(`${TAGS.MCP} ${toolName}: formatting failed, returning raw data`, e)
    return formatToolResponse({
      summary: `${toolName} completed. Raw data attached.`,
      data: rawData,
      structuredContent: rawData,
    })
  }
}

/**
 * Helper to wrap tool handlers with common logic like customerId resolution
 * and error handling.
 * @param {object} toolDef - The tool definition object
 * @param {(...args: unknown[]) => unknown} [toolDef.validate] - Optional validation function
 * @param {(...args: unknown[]) => unknown} [toolDef.transform] - Optional parameter transformation function
 * @param {(...args: unknown[]) => unknown} toolDef.handler - The main tool handler function
 * @param {boolean} [toolDef.skipAutoResolve] - Whether to skip auto-resolving customerId
 * @param {boolean} [toolDef.skipAuthCheck] - Whether to skip checking if tokens are valid.
 * @param {boolean} [toolDef.requiresDelegation] - Whether this tool requires domain-wide delegation in SA mode.
 * @param {string[]} [toolDef.scopes] - Scopes required for this tool. Defaults to all SCOPES.
 * @param {object} options - Configuration options for the wrapper
 * @param {object} [options.apiClients] - Collection of API clients
 * @param {object} [options.apiOptions] - Additional API options
 * @param {(...args: unknown[]) => unknown} [options.onError] - Custom error handler
 * @param {object} sessionState - The session state object for caching
 * @returns {(...args: unknown[]) => unknown} The wrapped tool handler function
 */
export function guardedToolCall(
  {
    validate,
    transform,
    handler,
    skipAutoResolve = false,
    skipAuthCheck = false,
    requiresDelegation = false,
    scopes = getActiveScopes(),
  },
  options = {},
  sessionState = { customerId: null, cachedRootOrgUnitId: null },
) {
  const wrapped = async (params, context) => {
    const authToken = params?.accessToken || getAuthToken(context?.requestInfo)
    if (!skipAuthCheck) {
      if (authToken) {
        // Inbound Bearer token present: skip local disk checks and forward directly to Google APIs
      } else if (isBearerMode()) {
        const msg =
          'Authentication failed: Server is configured in strict "bearer-only" mode, ' +
          'but no Authorization token was passed in the request.'
        return {
          content: [{ type: 'text', text: msg }],
          structuredContent: { status: 'error', code: 'BEARER_ONLY_REQUIRED', message: msg },
          isError: true,
        }
      } else if (isServiceAccountMode() || (isDynamicMode() && process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        if (isServiceAccountMode() && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          const msg =
            'Authentication failed: Server is configured in strict "service-account-only" mode, ' +
            'but GOOGLE_APPLICATION_CREDENTIALS is not set.'
          return {
            content: [{ type: 'text', text: msg }],
            structuredContent: { status: 'error', code: 'SERVICE_ACCOUNT_REQUIRED', message: msg },
            isError: true,
          }
        }
        if (requiresDelegation && !process.env.CEP_IMPERSONATE_SUBJECT) {
          const text =
            'Error: Tool requires Domain-Wide Delegation (requiresDelegation: true) to access user-scoped directory or policy data. ' +
            'You are authenticated in Service Account mode (GOOGLE_APPLICATION_CREDENTIALS is set), but CEP_IMPERSONATE_SUBJECT is not specified. ' +
            'To use this tool, set CEP_IMPERSONATE_SUBJECT to the email address of a Google Workspace user account with delegated privileges (Option 1). ' +
            'Alternatively, if you are using direct Admin Console role assignments without user impersonation (Option 2), ' +
            'use Option 2 compatible tools such as list_org_units, security_insights, or count_browser_versions with an explicit customerId.'
          return {
            content: [{ type: 'text', text }],
            isError: true,
          }
        }
      } else {
        const validity = await isTokenLocallyValid({ scopes })
        if (!validity.ok) {
          return buildAuthRequiredResponse(validity)
        }
      }
    }
    try {
      let apiOptions = options.apiOptions || {}
      if (options.server && !apiOptions.onStatusUpdate) {
        const server = options.server
        const onStatusUpdate = msg => {
          try {
            if (typeof server?.sendLoggingMessage === 'function') {
              server.sendLoggingMessage({ level: 'info', data: msg }).catch(() => {})
            }
          } catch {
            // ignore
          }
        }
        apiOptions = { ...apiOptions, onStatusUpdate }
      }
      const { apiClients } = options
      let currentParams = { ...params }
      delete currentParams.accessToken
      if (sessionState && currentParams.customerId) {
        sessionState.customerId = currentParams.customerId
      }

      if (!skipAutoResolve && currentParams.customerId === undefined) {
        if (sessionState && sessionState.customerId) {
          currentParams.customerId = sessionState.customerId
        } else {
          try {
            if (apiClients && apiClients.adminSdk && typeof apiClients.adminSdk.getCustomerId === 'function') {
              const customer = await apiClients.adminSdk.getCustomerId(authToken, apiOptions)
              if (customer && customer.id) {
                if (sessionState) {
                  sessionState.customerId = customer.id
                }
                currentParams.customerId = customer.id
              } else {
                logger.error(`${TAGS.MCP} Failed to auto-resolve customerId: No customer object returned.`)
              }
            } else {
              logger.error(`${TAGS.MCP} adminSdkClient not provided to guardedToolCall`)
            }
          } catch (error) {
            logger.error(`${TAGS.MCP} Failed to auto-resolve customerId:`, error)
            throw error
          }
        }
      }

      let transformedParams = commonTransform(currentParams)
      if (transform) {
        transformedParams = transform(transformedParams)
      }
      if (validate) {
        validate(transformedParams)
      }

      const result = await handler(transformedParams, { ...context, authToken })
      logger.debug(`${TAGS.MCP} Handler result for '${context?.name || 'unknown'}':`, JSON.stringify(result, null, 2))

      if (result && !result.structuredContent && result.content) {
        logger.debug(`${TAGS.MCP} Tool handler returned content without structuredContent`)
      }
      return result
    } catch (error) {
      logger.error(`${TAGS.MCP} Tool handler error for '${context?.name || 'unknown'}':`, {
        message: error.message,
        stack: error.stack,
        details: error.response?.data || error,
      })

      if (options && options.onError) {
        const customErrorResponse = options.onError(error)
        if (customErrorResponse) {
          return customErrorResponse
        }
      }

      let errorMessage = error.message || ''
      if (!errorMessage && error.response?.data) {
        errorMessage = JSON.stringify(error.response.data)
      }
      if (!errorMessage) {
        errorMessage = JSON.stringify(error, null, 2)
      }
      if (errorMessage === '{}' || errorMessage === '[]' || !errorMessage) {
        errorMessage = error.toString()
      }

      const status = error.status || error.code || error.response?.status
      const isAuthError =
        status === 401 ||
        status === 403 ||
        errorMessage.includes('API Error 401') ||
        errorMessage.includes('API Error 403') ||
        errorMessage.includes('UNAUTHENTICATED') ||
        errorMessage.includes('PERMISSION_DENIED') ||
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('unauthorized_client') ||
        errorMessage.includes('Invalid Customer Id')

      if (isAuthError) {
        const resolvedStatus = errorMessage.includes('Invalid Customer Id')
          ? 401
          : status ||
            (errorMessage.includes('401') ||
            errorMessage.includes('UNAUTHENTICATED') ||
            errorMessage.includes('invalid_grant') ||
            errorMessage.includes('unauthorized_client')
              ? 401
              : 403)
        const bearerInbound = !!context?.authToken || !!context?.requestInfo?.headers?.authorization
        const remediationMessage = getAuthRemediationMessage(
          resolvedStatus,
          error,
          bearerInbound,
          context?.name,
          options.server,
        )
        return {
          content: [{ type: 'text', text: remediationMessage }],
          isError: true,
        }
      }

      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true,
      }
    }
  }

  wrapped._scopes = scopes
  wrapped.requiresDelegation = requiresDelegation
  return wrapped
}
