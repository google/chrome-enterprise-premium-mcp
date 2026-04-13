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
 * @fileoverview Wrapper utilities to guard and transform MCP tool calls.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { TAGS, SCOPES } from '../../lib/constants.js'
import { logger } from '../../lib/util/logger.js'
import { validateAndGetOrgUnitId } from './org-unit.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Generates a proactive remediation message for authentication errors.
 *
 * @param {number} status - The HTTP status code
 * @param {boolean} [isOAuth=false] - Whether the CLI is running in OAuth mode
 * @returns {string} The remediation message
 */
function getAuthRemediationMessage(status, isOAuth = false) {
  if (isOAuth) {
    if (status === 401) {
      return `Authentication required. Your OAuth session has expired or is invalid. Please run \`/mcp reauth\` in your Gemini CLI to re-authenticate.`
    }
    return `Permission denied. Your account lacks the required permissions or the necessary Google Cloud APIs are not enabled.

1. **Re-authenticate:** Run \`/mcp reauth\` in your Gemini CLI.
2. **Verify APIs are enabled:** Ensure \`admin.googleapis.com\`, \`chromemanagement.googleapis.com\`, \`chromepolicy.googleapis.com\`, and \`cloudidentity.googleapis.com\` are enabled in your Google Cloud project.`
  }

  const scopesList = [
    SCOPES.CHROME_MANAGEMENT_POLICY,
    SCOPES.CHROME_MANAGEMENT_REPORTS_READONLY,
    SCOPES.ADMIN_REPORTS_AUDIT_READONLY,
    SCOPES.ADMIN_DIRECTORY_ORGUNIT_READONLY,
    SCOPES.ADMIN_DIRECTORY_CUSTOMER_READONLY,
    SCOPES.LICENSING,
    SCOPES.CLOUD_IDENTITY_POLICIES,
    SCOPES.CLOUD_PLATFORM,
  ]

  const bashScopes = scopesList.map(s => `  "${s}"`).join('\n')
  const bashCommand = `SCOPES=(\n${bashScopes}\n)\ngcloud auth application-default login --scopes=$(IFS=,; echo "\${SCOPES[*]}")`

  const pwshScopes = scopesList.map(s => `  "${s}"`).join(',\n')
  const pwshCommand = `$scopes = @(\n${pwshScopes}\n)\ngcloud auth application-default login --scopes=($scopes -join ',')`

  if (status === 401) {
    return `Authentication required. Please set up your Application Default Credentials (ADC) by running the following command in your terminal:

**For Mac/Linux (Bash/Zsh):**
\`\`\`bash
${bashCommand}
\`\`\`

**For Windows (PowerShell):**
\`\`\`powershell
${pwshCommand}
\`\`\``
  }

  return `Permission denied. Your account lacks the required permissions or the necessary Google Cloud APIs are not enabled.

1. **Re-authenticate with all required scopes:**

   **For Mac/Linux (Bash/Zsh):**
   \`\`\`bash
   ${bashCommand}
   \`\`\`

   **For Windows (PowerShell):**
   \`\`\`powershell
   ${pwshCommand}
   \`\`\`

2. **Verify APIs are enabled:** Ensure \`admin.googleapis.com\`, \`chromemanagement.googleapis.com\`, \`chromepolicy.googleapis.com\`, and \`cloudidentity.googleapis.com\` are enabled in your Google Cloud project.`
}

/**
 * Extracts the authentication token from the request headers.
 *
 * @param {object} requestInfo - The request context object
 * @returns {string|null} The Bearer token if present, otherwise null
 */
function getAuthToken(requestInfo) {
  return requestInfo?.headers?.authorization ? requestInfo.headers.authorization.split(' ')[1] : null
}

/**
 * Performs common transformations on tool parameters.
 *
 * @param {object} params
 * @returns {object} Transformed parameters
 */
export function commonTransform(params) {
  const newParams = { ...params }
  if (newParams.orgUnitId) {
    newParams.orgUnitId = validateAndGetOrgUnitId(newParams.orgUnitId)
  }
  return newParams
}

/**
 * Injects system prompt and capabilities on the first tool call.
 *
 * @param {object} sessionState
 * @param {object} result
 */
function injectSystemContext(sessionState, result) {
  if (sessionState && !sessionState.hasInjectedSystemPrompt) {
    sessionState.hasInjectedSystemPrompt = true
    try {
      const promptPath = path.resolve(__dirname, '../../prompts/system-prompt.md')
      const capabilitiesPath = path.resolve(__dirname, '../../lib/knowledge/0-agent-capabilities.md')
      const parts = []

      if (fs.existsSync(promptPath)) {
        parts.push(fs.readFileSync(promptPath, 'utf8'))
      }
      if (fs.existsSync(capabilitiesPath)) {
        parts.push(fs.readFileSync(capabilitiesPath, 'utf8'))
      }

      if (parts.length > 0) {
        if (!result.content) {
          result.content = []
        }
        if (Array.isArray(result.content)) {
          result.content.push({
            type: 'text',
            text: parts.join('\n\n---\n\n'),
          })
        }
      }
    } catch (e) {
      console.error(`${TAGS.MCP} Failed to inject system prompt on first call:`, e)
    }
  }
}

/**
 * Formats a tool response with a summary and a fenced JSON block.
 *
 * @param {object} params
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
 *
 * @param {object} params
 * @param {any} params.rawData - The raw data to format
 * @param {Function} params.formatFn - Function that returns a formatToolResponse-compatible object
 * @param {string} params.toolName - Name of the tool for logging
 * @returns {object} Formatted tool response
 */
export function safeFormatResponse({ rawData, formatFn, toolName }) {
  try {
    return formatFn(rawData)
  } catch (e) {
    console.warn(`${TAGS.MCP} ${toolName}: formatting failed, returning raw data`, e)
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
 *
 * @param {object} toolDef
 * @param {Function} [toolDef.validate] - Optional validation function
 * @param {Function} [toolDef.transform] - Optional parameter transformation function
 * @param {Function} toolDef.handler - The main tool handler function
 * @param {boolean} [toolDef.skipAutoResolve] - Whether to skip auto-resolving customerId
 * @param {object} options
 * @param {object} sessionState - The session state object for caching
 * @returns {Function} Wrapped tool handler
 */
export function guardedToolCall(
  { validate, transform, handler, skipAutoResolve = false },
  options = {},
  sessionState = { customerId: null, cachedRootOrgUnitId: null },
) {
  return async (params, context) => {
    try {
      const { apiClients, apiOptions } = options
      let currentParams = { ...params }
      if (sessionState && currentParams.customerId) {
        sessionState.customerId = currentParams.customerId
      }

      const authToken = getAuthToken(context?.requestInfo)

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
                console.error(`${TAGS.MCP} ⚠️ Failed to auto-resolve customerId: No customer object returned.`)
              }
            } else {
              console.error(`${TAGS.MCP} ⚠️ adminSdkClient not provided to guardedToolCall`)
            }
          } catch (error) {
            console.error(`${TAGS.MCP} ⚠️ Failed to auto-resolve customerId:`, error)
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

      injectSystemContext(sessionState, result)

      if (result && !result.structuredContent && result.content) {
        logger.warn(`${TAGS.MCP} Tool handler returned content without structuredContent`)
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
        const isOAuth = !!context?.authToken || !!context?.requestInfo?.headers?.authorization
        const remediationMessage = getAuthRemediationMessage(resolvedStatus, isOAuth)
        return {
          content: [{ type: 'text', text: remediationMessage }],
          isError: true,
        }
      }

      if (errorMessage.includes('quota project')) {
        return {
          content: [{ type: 'text', text: `Configuration required. ${errorMessage.replace(/^Error:\s*/i, '')}` }],
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
