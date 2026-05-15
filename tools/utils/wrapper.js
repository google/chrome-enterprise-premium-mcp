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
import { logger } from '../../lib/util/logger.js'
import { validateAndGetOrgUnitId } from './org-unit.js'
import { isTokenLocallyValid } from '../../lib/util/credential/auth_login.js'

const MANUAL_AUTH_COMMAND = 'npx -y @google/chrome-enterprise-premium-mcp@latest auth login'
const AUTH_DOCS_URL =
  'https://github.com/google/chrome-enterprise-premium-mcp/blob/main/docs/configuration.md#authenticate-to-google-apis'

/**
 * Builds an MCP tool response signalling that sign-in is needed before any tool can run.
 * @param {{reason: 'missing'|'expired'|'malformed', expiresAt?: Date|null}} validity The reason the pre-flight failed.
 * @returns {object} MCP tool response with isError: true.
 */
function buildAuthRequiredResponse({ reason, expiresAt }) {
  const reasonLabel = reason === 'expired' ? 'expired' : reason === 'malformed' ? 'unreadable' : 'missing'
  const expiredAtNote = reason === 'expired' && expiresAt ? ` (expired at ${expiresAt.toISOString()})` : ''
  const text =
    `Sign-in is needed before this tool can run. The cached OAuth token is ${reasonLabel}${expiredAtNote}. ` +
    'I can run the `cep_auth` tool to sign you in, or you can run ' +
    `\`${MANUAL_AUTH_COMMAND}\` yourself.`
  return {
    content: [{ type: 'text', text }],
    structuredContent: {
      authRequired: {
        reason,
        expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : undefined,
        nextAction: 'invoke-cep_auth',
        manualCommand: MANUAL_AUTH_COMMAND,
        docsUrl: AUTH_DOCS_URL,
      },
    },
    isError: true,
  }
}

/**
 * Generates a proactive remediation message for authentication errors.
 * @param {number} status - The HTTP status code.
 * @param {boolean} [bearerInbound] - Whether the request arrived with an inbound Bearer token (HTTP transport).
 * @returns {string} The remediation message.
 */
function getAuthRemediationMessage(status, bearerInbound = false) {
  if (bearerInbound) {
    if (status === 401) {
      return `Authentication required. The inbound Bearer token has expired or is invalid. Re-authenticate through your MCP client to refresh the token.`
    }
    return `Permission denied. The authenticated principal lacks the required permissions, or the necessary Google Cloud APIs are not enabled.

1. **Re-authenticate:** Refresh the inbound Bearer token through your MCP client.
2. **Verify APIs are enabled:** Run the \`check_and_enable_cep_api\` tool against your project, or enable the API set listed in \`lib/constants.js#SERVICE_NAMES\`.`
  }

  if (status === 401) {
    return 'Authentication required. Run the `cep_auth` tool to sign in, or run `mcp auth login` at the shell to authorize the server (it caches the access token at ~/.config/cep-mcp/tokens.json). To use a service account, set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file.'
  }

  return `Permission denied. Your account lacks the required permissions or the necessary Google Cloud APIs are not enabled.

1. **Re-authenticate with all required scopes:** Run the \`cep_auth\` tool, or run \`mcp auth login\` at the shell, to re-consent. The required scope set is defined in lib/constants.js#SCOPES.
2. **Verify APIs are enabled:** Run the \`check_and_enable_cep_api\` tool against your project, or enable the API set listed in lib/constants.js#SERVICE_NAMES.`
}

/**
 * Extracts the authentication token from the request headers.
 * @param {object} requestInfo - The request context object
 * @returns {string|null} The Bearer token if present, otherwise null
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
 * @param {object} options - Configuration options for the wrapper
 * @param {object} [options.apiClients] - Collection of API clients
 * @param {object} [options.apiOptions] - Additional API options
 * @param {(...args: unknown[]) => unknown} [options.onError] - Custom error handler
 * @param {object} sessionState - The session state object for caching
 * @returns {(...args: unknown[]) => unknown} The wrapped tool handler function
 */
export function guardedToolCall(
  { validate, transform, handler, skipAutoResolve = false },
  options = {},
  sessionState = { customerId: null, cachedRootOrgUnitId: null },
) {
  return async (params, context) => {
    const authToken = getAuthToken(context?.requestInfo)
    if (!authToken) {
      const validity = await isTokenLocallyValid()
      if (!validity.ok) {
        return buildAuthRequiredResponse(validity)
      }
    }
    try {
      const { apiClients, apiOptions } = options
      let currentParams = { ...params }
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
        errorMessage.includes('invalid_grant')

      if (isAuthError) {
        const resolvedStatus =
          status ||
          (errorMessage.includes('401') ||
          errorMessage.includes('UNAUTHENTICATED') ||
          errorMessage.includes('invalid_grant')
            ? 401
            : 403)
        const bearerInbound = !!context?.authToken || !!context?.requestInfo?.headers?.authorization
        const remediationMessage = getAuthRemediationMessage(resolvedStatus, bearerInbound)
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
}
